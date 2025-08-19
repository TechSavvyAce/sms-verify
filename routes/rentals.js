const express = require("express");
const router = express.Router();
const { User, Rental, Transaction } = require("../models");
const { authenticateToken } = require("../middleware/auth");
const { Op } = require("sequelize");
const SMSActivateService = require("../services/SMSActivateService");
const WebhookService = require("../services/WebhookService");
const logger = require("../utils/logger");
const { calculateMarkupPrice } = require("../utils/helpers");

const smsService = new SMSActivateService();
const webhookService = new WebhookService();

/**
 * 获取可用的租用服务和国家
 * GET /api/rental/services
 */
router.get("/services", authenticateToken, async (req, res) => {
  try {
    const { time = 4, operator = "any", country = 0, incomingCall = false } = req.query;

    const result = await smsService.getRentServicesAndCountries(
      parseInt(time),
      operator,
      parseInt(country),
      incomingCall === "true"
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("获取租用服务失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 订购租用号码
 * POST /api/rental/order
 */
router.post("/order", authenticateToken, async (req, res) => {
  const transaction = await require("../config/database").transaction();

  try {
    const {
      service,
      time = 4,
      operator = "any",
      country = 0,
      incomingCall = false,
      webhook_url = "",
    } = req.body;

    const userId = req.user.id;

    // 验证必需参数
    if (!service) {
      return res.status(400).json({
        success: false,
        error: "服务名称不能为空",
      });
    }

    // 获取用户信息
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 获取价格信息（这里需要实现获取租用价格的方法）
    // 暂时使用固定价格，实际应该从SMS-Activate API获取
    const basePrice = 0.2; // 基础价格 $0.20
    const timeMultiplier = time / 4; // 时间倍数
    const originalPrice = basePrice * timeMultiplier;
    const finalPrice = calculateMarkupPrice(originalPrice);

    // 检查用户余额
    if (user.balance < finalPrice) {
      return res.status(400).json({
        success: false,
        error: "余额不足",
        required: finalPrice,
        current: user.balance,
      });
    }

    // 生成webhook URL（如果未提供）
    let finalWebhookUrl = webhook_url;
    if (!webhook_url) {
      const webhookConfig = webhookService.generateWebhookUrl("rental");
      finalWebhookUrl = webhookConfig.url;
      logger.info(`为租用生成webhook URL: ${finalWebhookUrl}`);
    }

    // 调用SMS-Activate API租用号码
    const rentalResult = await smsService.getRentNumber(
      service,
      parseInt(time),
      operator,
      parseInt(country),
      finalWebhookUrl,
      incomingCall
    );

    if (!rentalResult.success) {
      throw new Error(rentalResult.message || "租用号码失败");
    }

    // 扣除用户余额
    await user.update(
      {
        balance: user.balance - finalPrice,
        total_spent: user.total_spent + finalPrice,
      },
      { transaction }
    );

    // 创建租用记录
    const rental = await Rental.create(
      {
        user_id: userId,
        external_id: rentalResult.id.toString(),
        phone_number: rentalResult.phone,
        service: service,
        country_id: parseInt(country),
        operator: operator,
        time_hours: parseInt(time),
        price: finalPrice,
        original_price: originalPrice,
        status: "active",
        start_time: new Date(),
        end_time: new Date(rentalResult.endDate),
        webhook_url: finalWebhookUrl || null,
        incoming_call: incomingCall,
      },
      { transaction }
    );

    // 创建交易记录
    await Transaction.create(
      {
        user_id: userId,
        type: "rental",
        amount: -finalPrice,
        description: `租用号码 ${rentalResult.phone} - ${service}`,
        reference_id: rental.id.toString(),
        reference_type: "rental",
        status: "completed",
      },
      { transaction }
    );

    await transaction.commit();

    logger.info("用户租用号码成功:", {
      userId,
      rentalId: rental.id,
      phone: rentalResult.phone,
      service,
      price: finalPrice,
    });

    res.json({
      success: true,
      data: {
        id: rental.id,
        external_id: rental.external_id,
        phone: rental.phone_number,
        service: rental.service,
        country: rental.country_id,
        operator: rental.operator,
        time: rental.time_hours,
        price: rental.price,
        status: rental.status,
        start_time: rental.start_time,
        end_time: rental.end_time,
        remaining_balance: user.balance - finalPrice,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("租用号码失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取租用状态和短信
 * GET /api/rental/:id/status
 */
router.get("/:id/status", authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const userId = req.user.id;
    const { page = 1, size = 10 } = req.query;

    // 查找租用记录
    const rental = await Rental.findOne({
      where: {
        id: rentalId,
        user_id: userId,
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        error: "租用记录不存在",
      });
    }

    // 从SMS-Activate API获取状态
    const statusResult = await smsService.getRentStatus(
      rental.external_id,
      parseInt(page),
      parseInt(size)
    );

    if (!statusResult.success) {
      throw new Error(statusResult.message || "获取租用状态失败");
    }

    // 检查租用是否已过期
    const now = new Date();
    const isExpired = now > new Date(rental.end_time);

    // 如果已过期，更新状态
    if (isExpired && rental.status === "active") {
      await rental.update({ status: "expired" });
    }

    res.json({
      success: true,
      data: {
        rental: {
          id: rental.id,
          phone: rental.phone_number,
          service: rental.service,
          status: isExpired ? "expired" : rental.status,
          start_time: rental.start_time,
          end_time: rental.end_time,
          is_expired: isExpired,
        },
        messages: {
          quantity: statusResult.quantity,
          values: statusResult.values,
        },
      },
    });
  } catch (error) {
    logger.error("获取租用状态失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 延长租用时间
 * POST /api/rental/:id/extend
 */
router.post("/:id/extend", authenticateToken, async (req, res) => {
  const transaction = await require("../config/database").transaction();

  try {
    const rentalId = req.params.id;
    const userId = req.user.id;
    const { time = 4 } = req.body;

    // 验证延长时间
    if (!time || time < 4 || time > 1344) {
      return res.status(400).json({
        success: false,
        error: "延长时间必须在4-1344小时之间",
      });
    }

    // 查找租用记录
    const rental = await Rental.findOne({
      where: {
        id: rentalId,
        user_id: userId,
      },
      transaction,
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        error: "租用记录不存在",
      });
    }

    if (rental.status !== "active") {
      return res.status(400).json({
        success: false,
        error: "只能延长活跃状态的租用",
      });
    }

    // 获取用户信息
    const user = await User.findByPk(userId, { transaction });

    // 计算延长费用
    const basePrice = 0.2; // 基础价格
    const timeMultiplier = time / 4;
    const originalPrice = basePrice * timeMultiplier;
    const finalPrice = calculateMarkupPrice(originalPrice);

    // 检查用户余额
    if (user.balance < finalPrice) {
      return res.status(400).json({
        success: false,
        error: "余额不足",
        required: finalPrice,
        current: user.balance,
      });
    }

    // 调用SMS-Activate API延长租用
    const extendResult = await smsService.continueRentNumber(rental.external_id, parseInt(time));

    if (!extendResult.success) {
      throw new Error(extendResult.message || "延长租用失败");
    }

    // 扣除用户余额
    await user.update(
      {
        balance: user.balance - finalPrice,
        total_spent: user.total_spent + finalPrice,
      },
      { transaction }
    );

    // 更新租用记录
    const newEndTime = new Date(extendResult.endDate);
    await rental.update(
      {
        end_time: newEndTime,
        time_hours: rental.time_hours + parseInt(time),
        price: rental.price + finalPrice,
      },
      { transaction }
    );

    // 创建交易记录
    await Transaction.create(
      {
        user_id: userId,
        type: "rental_extend",
        amount: -finalPrice,
        description: `延长租用 ${rental.phone_number} - ${time}小时`,
        reference_id: rental.id.toString(),
        reference_type: "rental",
        status: "completed",
      },
      { transaction }
    );

    await transaction.commit();

    logger.info("用户延长租用成功:", {
      userId,
      rentalId: rental.id,
      extendTime: time,
      price: finalPrice,
      newEndTime,
    });

    res.json({
      success: true,
      data: {
        id: rental.id,
        phone: rental.phone_number,
        extended_time: time,
        new_end_time: newEndTime,
        cost: finalPrice,
        remaining_balance: user.balance - finalPrice,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("延长租用失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 取消租用
 * POST /api/rental/:id/cancel
 */
router.post("/:id/cancel", authenticateToken, async (req, res) => {
  const transaction = await require("../config/database").transaction();

  try {
    const rentalId = req.params.id;
    const userId = req.user.id;

    // 查找租用记录
    const rental = await Rental.findOne({
      where: {
        id: rentalId,
        user_id: userId,
      },
      transaction,
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        error: "租用记录不存在",
      });
    }

    if (rental.status !== "active") {
      return res.status(400).json({
        success: false,
        error: "只能取消活跃状态的租用",
      });
    }

    // 检查是否可以取消（租用时间超过20分钟不能取消）
    const now = new Date();
    const startTime = new Date(rental.start_time);
    const diffMinutes = (now - startTime) / (1000 * 60);

    if (diffMinutes > 20) {
      return res.status(400).json({
        success: false,
        error: "租用超过20分钟后不能取消",
      });
    }

    // 调用SMS-Activate API取消租用
    const cancelResult = await smsService.setRentStatus(rental.external_id, 2); // 2=取消

    if (!cancelResult.success) {
      throw new Error(cancelResult.message || "取消租用失败");
    }

    // 获取用户信息
    const user = await User.findByPk(userId, { transaction });

    // 退还部分费用（扣除少量手续费）
    const refundAmount = rental.price * 0.9; // 退还90%
    const feeAmount = rental.price * 0.1; // 10%手续费

    await user.update(
      {
        balance: user.balance + refundAmount,
      },
      { transaction }
    );

    // 更新租用状态
    await rental.update(
      {
        status: "cancelled",
        end_time: now,
      },
      { transaction }
    );

    // 创建退款交易记录
    await Transaction.create(
      {
        user_id: userId,
        type: "rental_refund",
        amount: refundAmount,
        description: `取消租用退款 ${rental.phone_number}`,
        reference_id: rental.id.toString(),
        reference_type: "rental",
        status: "completed",
      },
      { transaction }
    );

    // 创建手续费交易记录
    await Transaction.create(
      {
        user_id: userId,
        type: "rental_fee",
        amount: -feeAmount,
        description: `取消租用手续费 ${rental.phone_number}`,
        reference_id: rental.id.toString(),
        reference_type: "rental",
        status: "completed",
      },
      { transaction }
    );

    await transaction.commit();

    logger.info("用户取消租用成功:", {
      userId,
      rentalId: rental.id,
      refundAmount,
      feeAmount,
    });

    res.json({
      success: true,
      data: {
        id: rental.id,
        status: "cancelled",
        refund_amount: refundAmount,
        fee_amount: feeAmount,
        remaining_balance: user.balance + refundAmount,
        message: "租用已取消，已退还90%费用",
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("取消租用失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 完成租用
 * POST /api/rental/:id/finish
 */
router.post("/:id/finish", authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const userId = req.user.id;

    // 查找租用记录
    const rental = await Rental.findOne({
      where: {
        id: rentalId,
        user_id: userId,
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        error: "租用记录不存在",
      });
    }

    if (rental.status !== "active") {
      return res.status(400).json({
        success: false,
        error: "只能完成活跃状态的租用",
      });
    }

    // 调用SMS-Activate API完成租用
    const finishResult = await smsService.setRentStatus(rental.external_id, 1); // 1=完成

    if (!finishResult.success) {
      throw new Error(finishResult.message || "完成租用失败");
    }

    // 更新租用状态
    await rental.update({
      status: "completed",
      end_time: new Date(),
    });

    logger.info("用户完成租用:", {
      userId,
      rentalId: rental.id,
    });

    res.json({
      success: true,
      data: {
        id: rental.id,
        status: "completed",
        message: "租用已完成",
      },
    });
  } catch (error) {
    logger.error("完成租用失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取用户租用列表
 * GET /api/rental/list
 */
router.get("/list", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = null, service = null, country = null } = req.query;

    const where = { user_id: userId };

    if (status) {
      where.status = status;
    }
    if (service) {
      where.service = service;
    }
    if (country) {
      where.country_id = parseInt(country);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: rentals } = await Rental.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    // 检查并更新过期的租用
    const now = new Date();
    const activeRentals = rentals.filter((r) => r.status === "active");
    const expiredRentals = activeRentals.filter((r) => now > new Date(r.end_time));

    if (expiredRentals.length > 0) {
      await Rental.update(
        { status: "expired" },
        {
          where: {
            id: { [Op.in]: expiredRentals.map((r) => r.id) },
          },
        }
      );

      // 更新内存中的状态
      expiredRentals.forEach((rental) => {
        rental.status = "expired";
      });
    }

    const totalPages = Math.ceil(count / parseInt(limit));

    res.json({
      success: true,
      data: {
        rentals: rentals.map((rental) => ({
          id: rental.id,
          external_id: rental.external_id,
          phone: rental.phone_number,
          service: rental.service,
          country_id: rental.country_id,
          operator: rental.operator,
          time_hours: rental.time_hours,
          price: rental.price,
          status: rental.status,
          start_time: rental.start_time,
          end_time: rental.end_time,
          is_expired: now > new Date(rental.end_time),
          created_at: rental.created_at,
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_count: count,
          per_page: parseInt(limit),
        },
      },
    });
  } catch (error) {
    logger.error("获取租用列表失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取延长租用信息
 * GET /api/rental/:id/extend-info
 */
router.get("/:id/extend-info", authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const userId = req.user.id;
    const { hours = 4 } = req.query;

    // 查找租用记录
    const rental = await Rental.findOne({
      where: {
        id: rentalId,
        user_id: userId,
      },
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        error: "租用记录不存在",
      });
    }

    // 从SMS-Activate API获取延长信息
    const extendInfo = await smsService.continueRentInfo(
      rental.external_id,
      parseInt(hours),
      true // 需要历史记录
    );

    if (!extendInfo.success) {
      throw new Error(extendInfo.message || "获取延长信息失败");
    }

    // 计算本地标记价格
    const originalPrice = parseFloat(extendInfo.price);
    const markupPrice = calculateMarkupPrice(originalPrice);

    res.json({
      success: true,
      data: {
        rental_id: rental.id,
        hours: extendInfo.hours,
        original_price: originalPrice,
        markup_price: markupPrice,
        currency: extendInfo.currency,
        history: extendInfo.history,
      },
    });
  } catch (error) {
    logger.error("获取延长租用信息失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
