const express = require("express");
const sequelize = require("../config/database");
const { User, Activation, Transaction, PricingOverride } = require("../models");
const SMSActivateService = require("../services/SMSActivateService");
const WebhookService = require("../services/WebhookService");
const { authenticateToken, logUserActivity } = require("../middleware/auth");
const {
  validateActivationPurchase,
  validateStatusUpdate,
  validatePagination,
  validateId,
  createValidationMiddleware,
} = require("../middleware/validation");
const {
  getPaginationParams,
  buildPaginatedResponse,
  formatDateTime,
  calculateMarkupPrice,
} = require("../utils/helpers");
const logger = require("../utils/logger");
const router = express.Router();

const smsService = new SMSActivateService();
const webhookService = new WebhookService();

/**
 * 获取激活状态文本
 */
function getActivationStatusText(status) {
  const statusMap = {
    0: "等待短信",
    1: "等待重试",
    3: "已收到短信",
    6: "已取消",
    8: "激活完成",
  };
  return statusMap[status] || "未知状态";
}

/**
 * 计算退款金额
 */
function calculateRefundAmount(activation) {
  // 根据激活状态和时间计算退款金额
  if (activation.status === "0") {
    // 等待短信状态，可以全额退款
    return parseFloat(activation.cost);
  } else if (activation.status === "1") {
    // 等待重试状态，50%退款
    return parseFloat(activation.cost) * 0.5;
  }

  // 其他状态不退款
  return 0;
}

/**
 * 取消过期的激活
 */
async function cancelExpiredActivation(activation, io = null) {
  const transaction = await sequelize.transaction();

  try {
    // 计算退款
    const refundAmount = calculateRefundAmount(activation);

    if (refundAmount > 0) {
      const user = await User.findByPk(activation.user_id, { transaction });
      const balanceBefore = parseFloat(user.balance);
      const balanceAfter = balanceBefore + refundAmount;

      await user.update(
        {
          balance: balanceAfter,
        },
        { transaction }
      );

      await Transaction.create(
        {
          user_id: activation.user_id,
          type: "refund",
          amount: refundAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: activation.id.toString(),
          description: "激活过期自动退款",
        },
        { transaction }
      );
    }

    await activation.update(
      {
        status: "6",
        last_check_at: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    logger.info("过期激活自动取消:", {
      activationId: activation.id,
      refundAmount,
    });

    // 通知客户端余额更新（如果io可用）
    if (io && refundAmount > 0) {
      const user = await User.findByPk(activation.user_id);
      io.to(`user_${activation.user_id}`).emit("balance_updated", {
        new_balance: user.balance,
        change_amount: refundAmount,
        transaction_type: "refund_expired",
        reference_id: activation.id,
        description: "激活过期自动退款",
      });
    }
  } catch (error) {
    await transaction.rollback();
    logger.error("取消过期激活失败:", error);
    throw error;
  }
}

/**
 * 处理 SMS Activate Webhook 通知
 * POST /api/activations/webhook
 * 注意: 此端点不需要认证，因为它由SMS Activate外部服务调用
 */
router.post("/webhook", async (req, res) => {
  try {
    const { activationId, service, text, code, country, receivedAt } = req.body;

    logger.info("收到SMS Activate Webhook:", {
      activationId,
      service,
      text,
      code,
      country,
      receivedAt,
    });

    // 查找对应的激活记录
    const activation = await Activation.findOne({
      where: { activation_id: activationId.toString() },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username"],
        },
      ],
    });

    if (!activation) {
      logger.warn("未找到对应的激活记录:", { activationId });
      return res.status(404).json({ success: false, error: "激活记录不存在" });
    }

    // 更新激活状态和短信代码
    await activation.update({
      status: "3", // 已收到短信
      sms_code: code,
      last_check_at: new Date(),
    });

    // 通过全局io实例发送实时通知
    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`user_${activation.user_id}`).emit("activation_updated", {
        id: activation.id,
        status: "3",
        sms_code: code,
        status_text: getActivationStatusText("3"),
      });

      logger.info("已发送WebSocket通知到用户:", activation.user_id);
    }

    logger.info("Webhook处理成功:", {
      activationId: activation.id,
      userId: activation.user_id,
      code,
    });

    res.json({ success: true, message: "Webhook处理成功" });
  } catch (error) {
    logger.error("处理Webhook失败:", error);
    res.status(500).json({ success: false, error: "Webhook处理失败" });
  }
});

// 诊断端点（无需认证）
/**
 * 检查数据库连接
 * GET /api/activations/db-status
 */
router.get("/db-status", async (req, res) => {
  try {
    logger.info("检查数据库连接状态");

    // 测试数据库连接
    await sequelize.authenticate();
    logger.info("数据库连接成功");

    // 测试基本查询
    const activationCount = await Activation.count();
    logger.info("数据库查询成功", { activationCount });

    res.json({
      success: true,
      data: {
        databaseConnected: true,
        activationCount: activationCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("数据库连接检查失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: false,
    });
  }
});

/**
 * 检查SMS-Activate服务
 * GET /api/activations/sms-service-status
 */
router.get("/sms-service-status", async (req, res) => {
  try {
    logger.info("检查SMS-Activate服务状态");

    // 测试获取余额
    const balanceResult = await smsService.getBalance();
    logger.info("SMS-Activate服务测试成功", { balanceResult });

    res.json({
      success: true,
      data: {
        smsServiceConnected: true,
        balance: balanceResult,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("SMS-Activate服务检查失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      smsServiceConnected: false,
    });
  }
});

/**
 * 检查认证状态
 * GET /api/activations/auth-status
 */
router.get("/auth-status", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    logger.info("检查认证状态:", {
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    res.json({
      success: true,
      data: {
        hasAuthHeader: !!authHeader,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("检查认证状态失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 测试取消激活功能 - 最小版本（无需认证）
 * POST /api/activations/minimal-test-cancel/:id
 */
router.post("/minimal-test-cancel/:id", async (req, res) => {
  try {
    const activationId = req.params.id;

    logger.info("最小测试取消激活:", {
      activationId,
      timestamp: new Date().toISOString(),
    });

    // 只测试数据库连接和基本查询
    const activation = await Activation.findOne({
      where: {
        id: activationId,
      },
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: "激活记录不存在",
      });
    }

    // 测试 canCancel 方法
    const canCancel = activation.canCancel();
    const now = new Date();
    const createdTime = new Date(activation.created_at);
    const diffMinutes = (now.getTime() - createdTime.getTime()) / (1000 * 60);

    res.json({
      success: true,
      message: "最小测试成功",
      data: {
        activation: {
          id: activation.id,
          status: activation.status,
          canCancel: canCancel,
          created_at: activation.created_at,
          diffMinutes: diffMinutes,
          service: activation.service,
          cost: activation.cost,
        },
        timeInfo: {
          now: now.toISOString(),
          created: createdTime.toISOString(),
          diffMinutes: diffMinutes,
          canCancelAfter2Min: diffMinutes >= 2,
        },
      },
    });
  } catch (error) {
    logger.error("最小测试取消激活失败:", {
      error: error.message,
      stack: error.stack,
      activationId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 所有其他激活路由都需要认证
router.use(authenticateToken);

/**
 * 测试SMS Activate API连接
 * GET /api/activations/test-connection
 */
router.get("/test-connection", async (req, res) => {
  try {
    const testResult = await smsService.testConnection();
    res.json(testResult);
  } catch (error) {
    logger.error("测试API连接失败:", error);
    res.status(500).json({
      success: false,
      error: "测试API连接失败",
    });
  }
});

/**
 * 获取运营商列表
 * GET /api/activations/operators
 */
router.get("/operators", async (req, res) => {
  try {
    const { country } = req.query;
    const countryCode = country !== undefined ? parseInt(country) : null;

    const operators = await smsService.getOperators(countryCode);
    res.json({
      success: true,
      data: operators,
    });
  } catch (error) {
    logger.error("获取运营商列表失败:", error);
    res.status(500).json({
      success: false,
      error: "获取运营商列表失败",
      details: error.message,
    });
  }
});

/**
 * 获取价格信息
 * GET /api/activations/prices
 */
router.get("/prices", async (req, res) => {
  try {
    const { service, country } = req.query;
    const countryCode = country !== undefined ? parseInt(country) : null;

    const prices = await smsService.getPrices(service, countryCode);
    res.json({
      success: true,
      data: prices,
    });
  } catch (error) {
    logger.error("获取价格信息失败:", error);
    res.status(500).json({
      success: false,
      error: "获取价格信息失败",
      details: error.message,
    });
  }
});

/**
 * 购买激活号码 (标准模式)
 * POST /api/activations
 */
router.post(
  "/",
  createValidationMiddleware(validateActivationPurchase),
  logUserActivity("purchase_activation"),
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { service, country, operator } = req.body;
      const userId = req.user.id;

      // 使用数据库定价（不再依赖外部价格接口）
      const override = await PricingOverride.findOne({
        where: { service_code: service, country_id: country, enabled: true },
      });
      let cost;
      if (!override) {
        // 使用系统默认价格
        const defaultPriceStr = await SystemConfig.getConfig("default_activation_price_usd", "0.5");
        cost = parseFloat(defaultPriceStr);
      } else {
        cost = parseFloat(override.price);
      }

      // 检查用户余额
      const user = await User.findByPk(userId, { transaction });
      if (user.balance < cost) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "余额不足，请先充值",
          required_amount: cost,
          current_balance: parseFloat(user.balance),
        });
      }

      // 调用SMS-Activate API购买号码 (V2)
      let purchaseResult;
      try {
        // 生成唯一订单ID用于幂等性
        const orderId = `order_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        logger.info("开始调用SMS-Activate API (V2):", {
          service,
          country,
          operator,
          orderId,
        });

        // 生成webhook URL用于状态更新
        const webhookConfig = webhookService.generateWebhookUrl("activation");
        logger.info(`为激活生成webhook URL: ${webhookConfig.url}`);

        // 构建高级选项
        const advancedOptions = {
          forward: 0, // 默认不需要转发
          activationType: 0, // 默认SMS激活
          language: "en", // 默认英语
          userId: "2320238", // 使用指定的用户ID
          webhook_url: webhookConfig.url, // 添加webhook URL
        };

        purchaseResult = await smsService.purchaseActivation(
          service,
          country,
          operator,
          null, // maxPrice - 暂时不使用FreePrice
          orderId,
          advancedOptions
        );
        logger.info("SMS-Activate API调用成功 (V2):", purchaseResult);
      } catch (apiError) {
        await transaction.rollback();
        logger.error("SMS-Activate API购买失败:", {
          error: apiError.message,
          service,
          country,
          operator,
          stack: apiError.stack,
        });
        return res.status(400).json({
          success: false,
          error: `购买失败: ${apiError.message}`,
          details: process.env.NODE_ENV === "development" ? apiError.stack : undefined,
        });
      }

      // 扣除用户余额
      const balanceBefore = parseFloat(user.balance);
      const balanceAfter = balanceBefore - cost;

      await user.update(
        {
          balance: balanceAfter,
          total_spent: parseFloat(user.total_spent) + cost,
        },
        { transaction }
      );

      // 创建激活记录
      const activation = await Activation.create(
        {
          user_id: userId,
          activation_id: purchaseResult.id,
          service,
          country_id: country,
          phone_number: purchaseResult.number,
          cost,
          status: "0", // 等待短信
          expires_at: new Date(Date.now() + 20 * 60 * 1000), // 20分钟后过期
          check_count: 0,
        },
        { transaction }
      );

      // 记录交易
      await Transaction.create(
        {
          user_id: userId,
          type: "activation",
          amount: -cost, // 负数表示支出
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: activation.id.toString(),
          description: `购买 ${smsService.getServiceName(
            service
          )} 激活号码 - ${smsService.getCountryName(country)}`,
        },
        { transaction }
      );

      await transaction.commit();

      // 通知客户端更新余额和激活记录
      req.io.to(`user_${userId}`).emit("balance_updated", {
        new_balance: balanceAfter,
        change_amount: -cost,
        transaction_type: "purchase",
        reference_id: activation.id,
        description: `购买 ${smsService.getServiceName(service)} 激活号码`,
      });

      req.io.to(`user_${userId}`).emit("activation_created", {
        id: activation.id,
        service,
        phone_number: purchaseResult.number,
        status: "0",
        cost,
      });

      logger.info("激活号码购买成功:", {
        userId,
        activationId: activation.id,
        service,
        country,
        phoneNumber: purchaseResult.number,
        cost,
      });

      res.status(201).json({
        success: true,
        message: "激活号码购买成功",
        data: {
          id: activation.id,
          activation_id: purchaseResult.id,
          service,
          service_name: smsService.getServiceName(service),
          country_id: country,
          country_name: smsService.getCountryName(country),
          phone_number: purchaseResult.number,
          cost: parseFloat(cost),
          status: "0",
          status_text: "等待短信",
          expires_at: formatDateTime(activation.expires_at),
          created_at: formatDateTime(activation.created_at),
        },
      });
    } catch (error) {
      await transaction.rollback();
      logger.error("购买激活号码失败:", error);
      res.status(500).json({
        success: false,
        error: "购买激活号码失败",
      });
    }
  }
);

/**
 * 使用 FreePrice 购买激活号码
 * POST /api/activations/freeprice
 */
router.post(
  "/freeprice",
  createValidationMiddleware(validateActivationPurchase),
  logUserActivity("purchase_activation_freeprice"),
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { service, country, operator, maxPrice } = req.body;
      const userId = req.user.id;

      // 验证 maxPrice 参数
      if (!maxPrice || maxPrice <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "FreePrice 模式下必须指定有效的最大价格",
        });
      }

      // 使用数据库定价（不再依赖外部价格接口）
      const override = await PricingOverride.findOne({
        where: { service_code: service, country_id: country, enabled: true },
      });
      let originalCost;
      if (!override) {
        const defaultPriceStr = await SystemConfig.getConfig("default_activation_price_usd", "0.5");
        originalCost = parseFloat(defaultPriceStr);
      } else {
        originalCost = parseFloat(override.price);
      }

      // 检查 maxPrice 是否合理
      if (maxPrice < originalCost) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `最大价格不能低于原价 ${originalCost} USD`,
          original_price: originalCost,
          max_price: maxPrice,
        });
      }

      const cost = Math.min(maxPrice, originalCost);

      // 检查用户余额
      const user = await User.findByPk(userId, { transaction });
      if (user.balance < cost) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "余额不足，请先充值",
          required_amount: cost,
          current_balance: parseFloat(user.balance),
        });
      }

      // 调用SMS-Activate API购买号码 (FreePrice模式)
      let purchaseResult;
      try {
        // 生成唯一订单ID用于幂等性
        const orderId = `freeprice_${userId}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        logger.info("开始调用SMS-Activate API (FreePrice):", {
          service,
          country,
          operator,
          maxPrice,
          orderId,
        });

        // 生成webhook URL用于状态更新
        const webhookConfig = webhookService.generateWebhookUrl("activation");
        logger.info(`为激活生成webhook URL: ${webhookConfig.url}`);

        // 构建高级选项
        const advancedOptions = {
          forward: 0, // 默认不需要转发
          activationType: 0, // 默认SMS激活
          language: "en", // 默认英语
          userId: "2320238", // 使用指定的用户ID
          webhook_url: webhookConfig.url, // 添加webhook URL
        };

        purchaseResult = await smsService.purchaseActivationWithFreePrice(
          service,
          country,
          operator,
          maxPrice,
          orderId,
          advancedOptions
        );
        logger.info("SMS-Activate API调用成功 (FreePrice):", purchaseResult);
      } catch (apiError) {
        await transaction.rollback();
        logger.error("SMS-Activate API购买失败 (FreePrice):", {
          error: apiError.message,
          service,
          country,
          operator,
          maxPrice,
          stack: apiError.stack,
        });
        return res.status(400).json({
          success: false,
          error: `购买失败: ${apiError.message}`,
          details: process.env.NODE_ENV === "development" ? apiError.stack : undefined,
        });
      }

      // 扣除用户余额
      const balanceBefore = parseFloat(user.balance);
      const balanceAfter = balanceBefore - cost;

      await user.update(
        {
          balance: balanceAfter,
          total_spent: parseFloat(user.total_spent) + cost,
        },
        { transaction }
      );

      // 创建激活记录
      const activation = await Activation.create(
        {
          user_id: userId,
          activation_id: purchaseResult.id,
          service,
          country_id: country,
          phone_number: purchaseResult.number,
          cost,
          status: "0", // 等待短信
          expires_at: new Date(Date.now() + 20 * 60 * 1000), // 20分钟后过期
          check_count: 0,
        },
        { transaction }
      );

      // 记录交易
      await Transaction.create(
        {
          user_id: userId,
          type: "activation_freeprice",
          amount: -cost, // 负数表示支出
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: activation.id.toString(),
          description: `FreePrice购买 ${smsService.getServiceName(
            service
          )} 激活号码 - ${smsService.getCountryName(country)} (最大价格: ${maxPrice} USD)`,
        },
        { transaction }
      );

      await transaction.commit();

      // 通知客户端更新余额和激活记录
      req.io.to(`user_${userId}`).emit("balance_updated", {
        new_balance: balanceAfter,
        change_amount: -cost,
        transaction_type: "purchase_freeprice",
        reference_id: activation.id,
        description: `FreePrice购买 ${smsService.getServiceName(service)} 激活号码`,
      });

      req.io.to(`user_${userId}`).emit("activation_created", {
        id: activation.id,
        service,
        phone_number: purchaseResult.number,
        status: "0",
        cost,
        is_freeprice: true,
        max_price: maxPrice,
      });

      logger.info("FreePrice激活号码购买成功:", {
        userId,
        activationId: activation.id,
        service,
        country,
        phoneNumber: purchaseResult.number,
        cost,
        maxPrice,
      });

      res.status(201).json({
        success: true,
        message: "FreePrice激活号码购买成功",
        data: {
          id: activation.id,
          activation_id: purchaseResult.id,
          service,
          service_name: smsService.getServiceName(service),
          country_id: country,
          country_name: smsService.getCountryName(country),
          phone_number: purchaseResult.number,
          cost: parseFloat(cost),
          status: "0",
          status_text: "等待短信",
          expires_at: formatDateTime(activation.expires_at),
          created_at: formatDateTime(activation.created_at),
          is_freeprice: true,
          max_price: maxPrice,
          actual_cost: purchaseResult.cost,
          currency: purchaseResult.currency,
          operator: purchaseResult.operator,
        },
      });
    } catch (error) {
      await transaction.rollback();
      logger.error("FreePrice购买激活号码失败:", error);
      res.status(500).json({
        success: false,
        error: "FreePrice购买激活号码失败",
      });
    }
  }
);

/**
 * 获取用户的激活列表
 * GET /api/activations
 */
router.get(
  "/",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("view_activations"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);
      const { status, service, country } = req.query;

      // 构建查询条件
      const whereClause = { user_id: req.user.id };

      if (status) {
        // Handle both single status and array of statuses
        if (Array.isArray(status)) {
          whereClause.status = status;
        } else if (typeof status === "string" && status.includes(",")) {
          // Handle comma-separated status values
          whereClause.status = status.split(",").map((s) => s.trim());
        } else {
          whereClause.status = status;
        }
      }

      if (service) {
        whereClause.service = service;
      }

      if (country) {
        whereClause.country_id = parseInt(country);
      }

      const { count, rows: activations } = await Activation.findAndCountAll({
        where: whereClause,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      // 格式化激活数据
      const formattedActivations = activations.map((activation) => ({
        id: activation.id,
        activation_id: activation.activation_id,
        service: activation.service,
        service_name: smsService.getServiceName(activation.service),
        country_id: activation.country_id,
        country_name: smsService.getCountryName(activation.country_id),
        phone_number: activation.phone_number,
        cost: parseFloat(activation.cost),
        status: activation.status,
        status_text: getActivationStatusText(activation.status),
        sms_code: activation.sms_code,
        expires_at: formatDateTime(activation.expires_at),
        last_check_at: activation.last_check_at ? formatDateTime(activation.last_check_at) : null,
        check_count: activation.check_count,
        created_at: formatDateTime(activation.created_at),
        can_cancel: activation.canCancel(),
        is_expired: activation.isExpired(),
        is_completed: activation.isCompleted(),
      }));

      const response = buildPaginatedResponse(formattedActivations, count, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取激活列表失败:", error);
      res.status(500).json({
        success: false,
        error: "获取激活列表失败",
      });
    }
  }
);

/**
 * 获取指定激活详情
 * GET /api/activations/:id
 */
router.get(
  "/:id",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("view_activation_detail"),
  async (req, res) => {
    try {
      const activationId = req.params.id;

      const activation = await Activation.findOne({
        where: {
          id: activationId,
          user_id: req.user.id,
        },
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: "激活记录不存在",
        });
      }

      res.json({
        success: true,
        data: {
          id: activation.id,
          activation_id: activation.activation_id,
          service: activation.service,
          service_name: smsService.getServiceName(activation.service),
          country_id: activation.country_id,
          country_name: smsService.getCountryName(activation.country_id),
          phone_number: activation.phone_number,
          cost: parseFloat(activation.cost),
          status: activation.status,
          status_text: getActivationStatusText(activation.status),
          sms_code: activation.sms_code,
          expires_at: formatDateTime(activation.expires_at),
          last_check_at: activation.last_check_at ? formatDateTime(activation.last_check_at) : null,
          check_count: activation.check_count,
          created_at: formatDateTime(activation.created_at),
          updated_at: formatDateTime(activation.updated_at),
          can_cancel: activation.canCancel(),
          is_expired: activation.isExpired(),
          is_completed: activation.isCompleted(),
        },
      });
    } catch (error) {
      logger.error("获取激活详情失败:", error);
      res.status(500).json({
        success: false,
        error: "获取激活详情失败",
      });
    }
  }
);

/**
 * 检查激活状态
 * GET /api/activations/:id/status
 */
router.get(
  "/:id/status",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("check_activation_status"),
  async (req, res) => {
    try {
      const activationId = req.params.id;

      const activation = await Activation.findOne({
        where: {
          id: activationId,
          user_id: req.user.id,
        },
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: "激活记录不存在",
        });
      }

      // 如果已经完成或取消，直接返回当前状态
      if (activation.isCompleted() || activation.status === "6") {
        return res.json({
          success: true,
          data: {
            status: activation.status,
            status_text: getActivationStatusText(activation.status),
            sms_code: activation.sms_code,
            last_check_at: formatDateTime(activation.last_check_at),
          },
        });
      }

      // 检查是否过期
      if (activation.isExpired()) {
        // 自动取消过期的激活
        await cancelExpiredActivation(activation, req.io);
        return res.json({
          success: true,
          data: {
            status: "6",
            status_text: "已取消（过期）",
            sms_code: null,
            last_check_at: formatDateTime(new Date()),
          },
        });
      }

      // 调用API检查状态
      try {
        const statusResult = await smsService.checkActivationStatus(activation.activation_id);

        // 更新本地状态
        await activation.updateStatus(statusResult.status, statusResult.code);

        // 如果收到短信，通知客户端
        if (statusResult.code) {
          req.io.to(`user_${req.user.id}`).emit("activation_updated", {
            id: activation.id,
            status: statusResult.status,
            sms_code: statusResult.code,
          });
        }

        res.json({
          success: true,
          data: {
            status: statusResult.status,
            status_text: getActivationStatusText(statusResult.status),
            sms_code: statusResult.code,
            last_check_at: formatDateTime(new Date()),
          },
        });
      } catch (apiError) {
        logger.error("检查激活状态失败:", apiError);
        res.status(400).json({
          success: false,
          error: `状态检查失败: ${apiError.message}`,
        });
      }
    } catch (error) {
      logger.error("检查激活状态失败:", error);
      res.status(500).json({
        success: false,
        error: "检查激活状态失败",
      });
    }
  }
);

/**
 * 取消激活
 * POST /api/activations/:id/cancel
 */
router.post(
  "/:id/cancel",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("cancel_activation"),
  async (req, res) => {
    try {
      let transaction;

      try {
        logger.info("开始取消激活流程:", {
          activationId: req.params.id,
          userId: req.user?.id,
          userExists: !!req.user,
          timestamp: new Date().toISOString(),
        });

        // 检查用户是否已认证
        if (!req.user) {
          logger.error("用户未认证:", {
            activationId: req.params.id,
            hasUser: !!req.user,
          });
          return res.status(401).json({
            success: false,
            error: "用户未认证",
          });
        }

        transaction = await sequelize.transaction();
        logger.info("数据库事务创建成功");
      } catch (transactionError) {
        logger.error("创建数据库事务失败:", {
          error: transactionError.message,
          stack: transactionError.stack,
        });
        return res.status(500).json({
          success: false,
          error: "数据库连接失败",
          details: {
            errorName: transactionError.name,
            errorCode: transactionError.code,
          },
        });
      }

      try {
        const activationId = req.params.id;

        logger.info("查找激活记录:", { activationId, userId: req.user.id });

        const activation = await Activation.findOne({
          where: {
            id: activationId,
            user_id: req.user.id,
          },
          transaction,
        });

        if (!activation) {
          logger.warn("激活记录不存在:", { activationId, userId: req.user.id });
          await transaction.rollback();
          return res.status(404).json({
            success: false,
            error: "激活记录不存在",
          });
        }

        logger.info("找到激活记录:", {
          id: activation.id,
          status: activation.status,
          service: activation.service,
          created_at: activation.created_at,
        });

        logger.info("检查是否可以取消:", {
          canCancel: activation.canCancel(),
          status: activation.status,
          created_at: activation.created_at,
          now: new Date().toISOString(),
        });

        if (!activation.canCancel()) {
          logger.warn("激活无法取消:", {
            id: activation.id,
            status: activation.status,
            canCancel: activation.canCancel(),
          });
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: "该激活无法取消",
          });
        }

        // 调用API取消激活
        try {
          logger.info("开始调用API取消激活:", {
            activationId: activation.activation_id,
            service: activation.service,
            status: activation.status,
          });

          const apiResult = await smsService.cancelActivation(activation.activation_id);
          logger.info("API取消激活成功:", apiResult);
        } catch (apiError) {
          logger.warn("API取消激活失败，继续本地处理:", {
            error: apiError.message,
            stack: apiError.stack,
            activationId: activation.activation_id,
          });
          // 即使API调用失败，也继续本地取消流程
        }

        // 计算退款金额（可能需要根据业务规则调整）
        logger.info("计算退款金额:", {
          activationId: activation.id,
          status: activation.status,
          cost: activation.cost,
        });

        const refundAmount = calculateRefundAmount(activation);

        logger.info("退款金额计算结果:", {
          refundAmount,
          activationCost: activation.cost,
          activationStatus: activation.status,
        });

        if (refundAmount > 0) {
          // 退款给用户
          logger.info("开始处理退款:", {
            userId: req.user.id,
            refundAmount,
          });

          const user = await User.findByPk(req.user.id, { transaction });
          if (!user) {
            logger.error("用户不存在:", { userId: req.user.id });
            throw new Error("用户不存在");
          }

          logger.info("找到用户:", {
            userId: user.id,
            currentBalance: user.balance,
          });

          const balanceBefore = parseFloat(user.balance);
          const balanceAfter = balanceBefore + refundAmount;

          logger.info("更新用户余额:", {
            userId: req.user.id,
            balanceBefore,
            refundAmount,
            balanceAfter,
          });

          await user.update(
            {
              balance: balanceAfter.toFixed(2),
            },
            { transaction }
          );

          // 记录退款交易
          logger.info("创建退款交易记录:", {
            userId: req.user.id,
            type: "refund",
            amount: refundAmount,
            balanceBefore,
            balanceAfter,
            referenceId: activation.id.toString(),
            description: `取消激活退款 - ${activation.service_name || activation.service}`,
          });

          try {
            await Transaction.create(
              {
                user_id: req.user.id,
                type: "refund",
                amount: refundAmount.toFixed(2),
                balance_before: balanceBefore.toFixed(2),
                balance_after: balanceAfter.toFixed(2),
                reference_id: activation.id.toString(),
                description: `取消激活退款 - ${activation.service_name || activation.service}`,
              },
              { transaction }
            );
            logger.info("退款交易记录创建成功");
          } catch (transactionCreateError) {
            logger.error("创建退款交易记录失败:", {
              error: transactionCreateError.message,
              stack: transactionCreateError.stack,
              transactionData: {
                user_id: req.user.id,
                type: "refund",
                amount: refundAmount.toFixed(2),
                balance_before: balanceBefore.toFixed(2),
                balance_after: balanceAfter.toFixed(2),
                reference_id: activation.id.toString(),
              },
            });
            throw transactionCreateError;
          }
        }

        // 更新激活状态
        logger.info("更新激活状态为已取消:", {
          activationId: activation.id,
          oldStatus: activation.status,
          newStatus: "6",
        });

        try {
          await activation.update(
            {
              status: "6", // 已取消
              last_check_at: new Date(),
            },
            { transaction }
          );
          logger.info("激活状态更新成功");
        } catch (activationUpdateError) {
          logger.error("更新激活状态失败:", {
            error: activationUpdateError.message,
            stack: activationUpdateError.stack,
            activationId: activation.id,
          });
          throw activationUpdateError;
        }

        logger.info("提交事务:", {
          activationId: activation.id,
          refundAmount,
        });

        try {
          await transaction.commit();
          logger.info("事务提交成功");
        } catch (commitError) {
          logger.error("事务提交失败:", {
            error: commitError.message,
            stack: commitError.stack,
            activationId: activation.id,
          });
          throw commitError;
        }

        // 通知客户端余额更新和激活取消
        try {
          logger.info("检查WebSocket对象:", {
            hasIo: !!req.io,
            ioType: typeof req.io,
            userId: req.user.id,
          });

          if (refundAmount > 0) {
            logger.info("发送余额更新通知:", {
              userId: req.user.id,
              newBalance: balanceAfter,
              refundAmount,
            });

            if (req.io) {
              req.io.to(`user_${req.user.id}`).emit("balance_updated", {
                new_balance: balanceAfter,
                change_amount: refundAmount,
                transaction_type: "refund",
                reference_id: activation.id,
                description: `取消激活退款 - ${activation.service_name || activation.service}`,
              });
              logger.info("余额更新通知发送成功");
            } else {
              logger.warn("WebSocket对象不存在，跳过余额更新通知");
            }
          }

          logger.info("发送激活取消通知:", {
            userId: req.user.id,
            activationId: activation.id,
            refundAmount,
          });

          if (req.io) {
            req.io.to(`user_${req.user.id}`).emit("activation_cancelled", {
              id: activation.id,
              refund_amount: refundAmount,
            });
            logger.info("激活取消通知发送成功");
          } else {
            logger.warn("WebSocket对象不存在，跳过激活取消通知");
          }
        } catch (wsError) {
          logger.warn("WebSocket通知发送失败:", {
            error: wsError.message,
            stack: wsError.stack,
          });
          // WebSocket错误不应该影响主要流程
        }

        logger.info("激活取消成功:", {
          userId: req.user.id,
          activationId: activation.id,
          refundAmount,
        });

        res.json({
          success: true,
          message: "激活已取消",
          data: {
            status: "6",
            status_text: "已取消",
            refund_amount: refundAmount,
          },
        });
      } catch (error) {
        if (transaction) {
          try {
            await transaction.rollback();
            logger.info("事务已回滚");
          } catch (rollbackError) {
            logger.error("事务回滚失败:", rollbackError);
          }
        }

        logger.error("取消激活失败:", {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          activationId: req.params.id,
          errorName: error.name,
          errorCode: error.code,
        });

        // 返回更具体的错误信息
        const errorMessage = error.message || "取消激活失败";
        res.status(500).json({
          success: false,
          error: errorMessage,
          details: {
            errorName: error.name,
            errorCode: error.code,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (outerError) {
      logger.error("取消激活外层错误捕获:", {
        error: outerError.message,
        stack: outerError.stack,
        activationId: req.params.id,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "取消激活失败",
        details: {
          errorName: outerError.name,
          errorCode: outerError.code,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * 检查数据库连接
 * GET /api/activations/db-status
 */
router.get("/db-status", async (req, res) => {
  try {
    logger.info("检查数据库连接状态");

    // 测试数据库连接
    await sequelize.authenticate();
    logger.info("数据库连接成功");

    // 测试基本查询
    const activationCount = await Activation.count();
    logger.info("数据库查询成功", { activationCount });

    res.json({
      success: true,
      data: {
        databaseConnected: true,
        activationCount: activationCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("数据库连接检查失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      databaseConnected: false,
    });
  }
});

/**
 * 检查SMS-Activate服务
 * GET /api/activations/sms-service-status
 */
router.get("/sms-service-status", async (req, res) => {
  try {
    logger.info("检查SMS-Activate服务状态");

    // 测试获取余额
    const balanceResult = await smsService.getBalance();
    logger.info("SMS-Activate服务测试成功", { balanceResult });

    res.json({
      success: true,
      data: {
        smsServiceConnected: true,
        balance: balanceResult,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("SMS-Activate服务检查失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      smsServiceConnected: false,
    });
  }
});

/**
 * 检查认证状态
 * GET /api/activations/auth-status
 */
router.get("/auth-status", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    logger.info("检查认证状态:", {
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    res.json({
      success: true,
      data: {
        hasAuthHeader: !!authHeader,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("检查认证状态失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 测试取消激活功能 - 简单版本（无需认证）
 * POST /api/activations/simple-test-cancel/:id
 */
router.post(
  "/simple-test-cancel/:id",
  createValidationMiddleware(validateId, "params"),
  async (req, res) => {
    try {
      const activationId = req.params.id;

      logger.info("简单测试取消激活:", {
        activationId,
        userId: req.user.id,
        timestamp: new Date().toISOString(),
      });

      // 只测试数据库连接和基本查询
      const activation = await Activation.findOne({
        where: {
          id: activationId,
          user_id: req.user.id,
        },
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: "激活记录不存在",
        });
      }

      // 测试 canCancel 方法
      const canCancel = activation.canCancel();
      const now = new Date();
      const createdTime = new Date(activation.created_at);
      const diffMinutes = (now.getTime() - createdTime.getTime()) / (1000 * 60);

      res.json({
        success: true,
        message: "简单测试成功",
        data: {
          activation: {
            id: activation.id,
            status: activation.status,
            canCancel: canCancel,
            created_at: activation.created_at,
            diffMinutes: diffMinutes,
            service: activation.service,
            cost: activation.cost,
          },
          timeInfo: {
            now: now.toISOString(),
            created: createdTime.toISOString(),
            diffMinutes: diffMinutes,
            canCancelAfter2Min: diffMinutes >= 2,
          },
        },
      });
    } catch (error) {
      logger.error("简单测试取消激活失败:", {
        error: error.message,
        stack: error.stack,
        activationId: req.params.id,
        userId: req.user.id,
      });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * 测试取消激活功能
 * POST /api/activations/test-cancel/:id
 */
router.post(
  "/test-cancel/:id",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("test_cancel_activation"),
  async (req, res) => {
    try {
      const activationId = req.params.id;

      logger.info("测试取消激活:", {
        activationId,
        userId: req.user.id,
      });

      const activation = await Activation.findOne({
        where: {
          id: activationId,
          user_id: req.user.id,
        },
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: "激活记录不存在",
        });
      }

      logger.info("找到激活记录:", {
        id: activation.id,
        status: activation.status,
        canCancel: activation.canCancel(),
        created_at: activation.created_at,
        service: activation.service,
      });

      res.json({
        success: true,
        message: "测试成功",
        data: {
          activation: {
            id: activation.id,
            status: activation.status,
            canCancel: activation.canCancel(),
            created_at: activation.created_at,
            service: activation.service,
          },
        },
      });
    } catch (error) {
      logger.error("测试取消激活失败:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * 批量检查激活状态
 * POST /api/activations/batch-check
 */
router.post("/batch-check", logUserActivity("batch_check_activations"), async (req, res) => {
  try {
    const { activation_ids } = req.body;

    if (!Array.isArray(activation_ids) || activation_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "激活ID列表不能为空",
      });
    }

    const activations = await Activation.findAll({
      where: {
        id: activation_ids,
        user_id: req.user.id,
        status: ["0", "1"], // 只检查等待中的激活
      },
    });

    const results = [];

    for (const activation of activations) {
      try {
        if (!activation.isExpired()) {
          const statusResult = await smsService.checkActivationStatus(activation.activation_id);
          await activation.updateStatus(statusResult.status, statusResult.code);

          results.push({
            id: activation.id,
            status: statusResult.status,
            sms_code: statusResult.code,
            success: true,
          });

          // 如果收到短信，通知客户端
          if (statusResult.code) {
            req.io.to(`user_${req.user.id}`).emit("activation_updated", {
              id: activation.id,
              status: statusResult.status,
              sms_code: statusResult.code,
            });
          }
        } else {
          // 处理过期的激活
          await cancelExpiredActivation(activation, req.io);
          results.push({
            id: activation.id,
            status: "6",
            sms_code: null,
            success: true,
            message: "已过期自动取消",
          });
        }
      } catch (error) {
        results.push({
          id: activation.id,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        total_checked: results.length,
      },
    });
  } catch (error) {
    logger.error("批量检查激活状态失败:", error);
    res.status(500).json({
      success: false,
      error: "批量检查激活状态失败",
    });
  }
});

/**
 * 手动触发状态检查（管理员功能）
 * POST /api/activations/trigger-status-check
 */
router.post("/trigger-status-check", authenticateToken, async (req, res) => {
  try {
    // 检查用户权限（只有管理员可以触发）
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "权限不足，只有管理员可以触发状态检查",
      });
    }

    // 查找所有等待短信的激活记录
    const pendingActivations = await Activation.findAll({
      where: {
        status: ["0", "1"], // 0=等待短信, 1=等待重试
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username"],
        },
      ],
    });

    if (pendingActivations.length === 0) {
      return res.json({
        success: true,
        message: "没有待处理的激活记录",
        count: 0,
      });
    }

    logger.info(
      `管理员 ${req.user.username} 手动触发状态检查，共 ${pendingActivations.length} 个激活`
    );

    const smsService = new SMSActivateService();
    let updatedCount = 0;
    let errorCount = 0;

    for (const activation of pendingActivations) {
      try {
        // 检查是否过期
        const expiresAt = new Date(activation.expires_at);
        if (expiresAt <= new Date()) {
          await activation.update({
            status: "6", // 已过期
            last_check_at: new Date(),
          });

          // 通知用户
          req.io.to(`user_${activation.user_id}`).emit("activation_updated", {
            id: activation.id,
            status: "6",
            status_text: "已过期",
            sms_code: null,
          });

          updatedCount++;
          continue;
        }

        // 调用 SMS Activate API 检查状态
        const statusResult = await smsService.checkActivationStatus(activation.activation_id);

        // 如果状态有变化，更新数据库
        if (
          statusResult.status !== activation.status ||
          (statusResult.code && statusResult.code !== activation.sms_code)
        ) {
          await activation.update({
            status: statusResult.status,
            sms_code: statusResult.code || null,
            last_check_at: new Date(),
          });

          // 通知用户状态更新
          req.io.to(`user_${activation.user_id}`).emit("activation_updated", {
            id: activation.id,
            status: statusResult.status,
            sms_code: statusResult.code,
            status_text: getActivationStatusText(statusResult.status),
          });

          updatedCount++;

          // 如果收到短信验证码，记录日志
          if (statusResult.code) {
            logger.info(`激活 ${activation.id} 收到短信验证码: ${statusResult.code}`);
          }
        }

        // 添加延迟避免API限流
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        // 区分真正的错误和正常的等待状态
        if (error.message === "等待第一条短信" || error.message === "等待代码确认") {
          logger.debug(`检查激活 ${activation.id} 状态: ${error.message}`);
        } else {
          logger.error(`检查激活 ${activation.id} 状态失败:`, error);
        }
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `状态检查完成，共检查 ${pendingActivations.length} 个激活，更新 ${updatedCount} 个，错误 ${errorCount} 个`,
      data: {
        total: pendingActivations.length,
        updated: updatedCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    logger.error("手动触发状态检查失败:", error);
    res.status(500).json({
      success: false,
      error: "状态检查失败",
    });
  }
});

/**
 * 批量检查激活状态（用户功能）
 * POST /api/activations/bulk-check-status
 */
router.post("/bulk-check-status", authenticateToken, async (req, res) => {
  try {
    logger.info("开始批量检查激活状态:", {
      userId: req.user.id,
      username: req.user.username,
      body: req.body,
    });

    const { activation_ids } = req.body;

    if (!activation_ids || !Array.isArray(activation_ids) || activation_ids.length === 0) {
      logger.warn("批量检查参数无效:", { activation_ids });
      return res.status(400).json({
        success: false,
        error: "请提供要检查的激活ID列表",
      });
    }

    // 限制一次最多检查10个激活
    if (activation_ids.length > 10) {
      logger.warn("批量检查数量超限:", { count: activation_ids.length });
      return res.status(400).json({
        success: false,
        error: "一次最多只能检查10个激活",
      });
    }

    logger.info("查找激活记录:", { activation_ids, userId: req.user.id });

    // 查找用户的激活记录
    const activations = await Activation.findAll({
      where: {
        id: activation_ids,
        user_id: req.user.id,
        status: ["0", "1", "3"], // 只检查活跃状态的激活
      },
    });

    logger.info("找到激活记录:", { count: activations.length });

    if (activations.length === 0) {
      return res.json({
        success: true,
        message: "没有找到有效的激活记录",
        data: {
          count: 0,
          total: 0,
          updated: 0,
          errors: 0,
          results: [],
        },
      });
    }

    logger.info(`用户 ${req.user.username} 批量检查 ${activations.length} 个激活状态`);

    const smsService = new SMSActivateService();
    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const activation of activations) {
      try {
        logger.debug(`检查激活 ${activation.id}:`, {
          status: activation.status,
          expiresAt: activation.expires_at,
        });

        // 检查是否过期
        const expiresAt = new Date(activation.expires_at);
        if (expiresAt <= new Date()) {
          logger.info(`激活 ${activation.id} 已过期，标记为过期`);

          await cancelExpiredActivation(activation, req.io);

          results.push({
            id: activation.id,
            status: "6",
            status_text: "已过期",
            sms_code: null,
            updated: true,
          });

          updatedCount++;
          continue;
        }

        // 调用 SMS Activate API 检查状态
        logger.debug(`调用SMS Activate API检查激活 ${activation.id} 状态`);
        const statusResult = await smsService.checkActivationStatus(activation.activation_id);

        logger.debug(`激活 ${activation.id} API响应:`, statusResult);

        // 如果状态有变化，更新数据库
        if (
          statusResult.status !== activation.status ||
          (statusResult.code && statusResult.code !== activation.sms_code)
        ) {
          logger.info(`激活 ${activation.id} 状态有变化:`, {
            oldStatus: activation.status,
            newStatus: statusResult.status,
            oldCode: activation.sms_code,
            newCode: statusResult.code,
          });

          await activation.update({
            status: statusResult.status,
            sms_code: statusResult.code || null,
            last_check_at: new Date(),
          });

          results.push({
            id: activation.id,
            status: statusResult.status,
            status_text: getActivationStatusText(statusResult.status),
            sms_code: statusResult.code,
            updated: true,
          });

          updatedCount++;

          // 如果收到短信验证码，记录日志
          if (statusResult.code) {
            logger.info(`激活 ${activation.id} 收到短信验证码: ${statusResult.code}`);
          }

          // 通知用户状态更新
          if (req.io) {
            req.io.to(`user_${activation.user_id}`).emit("activation_updated", {
              id: activation.id,
              status: statusResult.status,
              sms_code: statusResult.code,
              status_text: getActivationStatusText(statusResult.status),
            });
            logger.debug(`已发送WebSocket通知到用户 ${activation.user_id}`);
          } else {
            logger.warn("req.io 未定义，无法发送WebSocket通知");
          }
        } else {
          logger.debug(`激活 ${activation.id} 状态无变化`);
          results.push({
            id: activation.id,
            status: activation.status,
            status_text: getActivationStatusText(activation.status),
            sms_code: activation.sms_code,
            updated: false,
          });
        }

        // 添加延迟避免API限流
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        // 区分真正的错误和正常的等待状态
        if (error.message === "等待第一条短信" || error.message === "等待代码确认") {
          logger.debug(`检查激活 ${activation.id} 状态: ${error.message}`);
          results.push({
            id: activation.id,
            success: false,
            message: error.message,
          });
        } else {
          results.push({
            id: activation.id,
            success: false,
            error: error.message,
          });
        }
      }
    }

    const response = {
      success: true,
      message: `批量状态检查完成，共检查 ${activations.length} 个激活，更新 ${updatedCount} 个，错误 ${errorCount} 个`,
      data: {
        total: activations.length,
        updated: updatedCount,
        errors: errorCount,
        results,
      },
    };

    logger.info("批量检查完成:", response);
    res.json(response);
  } catch (error) {
    logger.error("批量检查激活状态失败:", error);
    res.status(500).json({
      success: false,
      error: "批量状态检查失败",
      details: error.message,
    });
  }
});

// 确认激活完成
router.post("/:id/confirm", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const activation = await Activation.findOne({
      where: { id, user_id: req.user.id },
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: "激活记录未找到",
      });
    }

    // 检查是否已收到短信验证码
    if (!activation.sms_code) {
      return res.status(400).json({
        success: false,
        error: "尚未收到短信验证码，无法确认完成",
      });
    }

    // 检查状态是否允许确认
    if (activation.status === "6" || activation.status === "8") {
      return res.status(400).json({
        success: false,
        error: "该激活已被取消或已完成",
      });
    }

    // 调用SMS-Activate API确认激活完成
    try {
      await smsService.confirmActivation(activation.activation_id);
      logger.info(`已调用SMS-Activate API确认激活 ${id} 完成`);
    } catch (apiError) {
      logger.warn("SMS-Activate API确认激活失败，继续本地处理:", apiError);
      // 即使API调用失败，也继续本地确认流程
    }

    // 更新状态为已完成
    await activation.update({
      status: "8", // 激活完成
      last_check_at: new Date(),
    });

    logger.info(`用户 ${req.user.id} 确认激活 ${id} 完成`);

    // 通知用户状态更新
    if (req.io) {
      req.io.to(`user_${req.user.id}`).emit("activation_updated", {
        id: activation.id,
        status: "8",
        status_text: "激活完成",
        sms_code: activation.sms_code,
      });
    }

    res.json({
      success: true,
      message: "激活已确认完成",
      data: {
        id: activation.id,
        status: "8",
        status_text: "激活完成",
        sms_code: activation.sms_code,
      },
    });
  } catch (error) {
    logger.error("确认激活失败:", error);
    res.status(500).json({
      success: false,
      error: "确认激活失败",
      details: error.message,
    });
  }
});

// 请求重发短信
router.post("/:id/retry", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const activation = await Activation.findOne({
      where: { id, user_id: req.user.id },
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: "激活记录未找到",
      });
    }

    // 检查状态是否允许重试
    if (activation.status !== "1" && activation.status !== "3") {
      return res.status(400).json({
        success: false,
        error: "该激活状态不允许重试",
      });
    }

    // 调用SMS-Activate API请求重发短信
    try {
      await smsService.requestRetry(activation.activation_id);
      logger.info(`已调用SMS-Activate API请求重发短信 ${id}`);
    } catch (apiError) {
      logger.warn("SMS-Activate API请求重发短信失败:", apiError);
      return res.status(500).json({
        success: false,
        error: "请求重发短信失败",
        details: apiError.message,
      });
    }

    // 更新状态为等待重试
    await activation.update({
      status: "1", // 等待重试
      last_check_at: new Date(),
    });

    logger.info(`用户 ${req.user.id} 请求重发短信 ${id}`);

    // 通知用户状态更新
    if (req.io) {
      req.io.to(`user_${req.user.id}`).emit("activation_updated", {
        id: activation.id,
        status: "1",
        status_text: "等待重试",
        sms_code: null,
      });
    }

    res.json({
      success: true,
      message: "已请求重发短信",
      data: {
        id: activation.id,
        status: "1",
        status_text: "等待重试",
      },
    });
  } catch (error) {
    logger.error("请求重发短信失败:", error);
    res.status(500).json({
      success: false,
      error: "请求重发短信失败",
      details: error.message,
    });
  }
});

module.exports = router;
