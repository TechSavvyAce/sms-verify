const express = require("express");
const router = express.Router();
const { User, Transaction } = require("../models");
const { authenticateToken } = require("../middleware/auth");
const WebhookService = require("../services/WebhookService");
const logger = require("../utils/logger");
const crypto = require("crypto");

const webhookService = new WebhookService();

/**
 * 生成支付链接
 * POST /api/payment/create
 */
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { service_name, description, amount, webhook_url, language = "zh-CN" } = req.body;

    const userId = req.user.id;

    // 验证必需参数
    if (!service_name || !description || !amount) {
      return res.status(400).json({
        success: false,
        error: "缺少必需参数：service_name, description, amount",
      });
    }

    // 验证金额
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "金额必须大于0",
      });
    }

    // 生成唯一的支付订单ID
    const orderId = `pay_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

    // 生成支付webhook URL（如果未提供）
    let finalWebhookUrl = webhook_url;
    if (!webhook_url) {
      const webhookConfig = webhookService.generateWebhookUrl("payment");
      finalWebhookUrl = webhookConfig.url;
      logger.info(`为支付订单生成webhook URL: ${finalWebhookUrl}`);
    }

    // 创建待支付的交易记录
    const transaction = await Transaction.create({
      user_id: userId,
      type: "recharge",
      amount: paymentAmount,
      description: `充值 - ${description}`,
      reference_id: orderId,
      reference_type: "payment",
      status: "pending",
      metadata: {
        service_name,
        webhook_url: finalWebhookUrl,
        language,
        payment_method: "online",
      },
    });

    // 生成支付链接（这里应该集成真实的支付服务提供商）
    // 示例使用模拟支付链接
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const paymentUrl = `${baseUrl}/payment/process?order_id=${orderId}&amount=${paymentAmount}&service=${encodeURIComponent(
      service_name
    )}`;

    // 生成支付二维码URL（可选）
    const qrCodeUrl = `${baseUrl}/api/payment/qrcode/${orderId}`;

    logger.info("创建支付订单:", {
      userId,
      orderId,
      amount: paymentAmount,
      service_name,
    });

    res.json({
      success: true,
      data: {
        order_id: orderId,
        payment_url: paymentUrl,
        qr_code_url: qrCodeUrl,
        amount: paymentAmount,
        currency: "USD",
        service_name,
        description,
        expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30分钟过期
        created_at: transaction.created_at,
      },
    });
  } catch (error) {
    logger.error("创建支付订单失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 生成支付二维码
 * GET /api/payment/qrcode/:orderId
 */
router.get("/qrcode/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    // 查找交易记录
    const transaction = await Transaction.findOne({
      where: {
        reference_id: orderId,
        reference_type: "payment",
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "支付订单不存在",
      });
    }

    // 生成二维码数据
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const paymentUrl = `${baseUrl}/payment/process?order_id=${orderId}&amount=${transaction.amount}`;

    // 这里应该使用二维码生成库，例如 qrcode
    // 暂时返回支付URL
    res.json({
      success: true,
      data: {
        qr_code_data: paymentUrl,
        payment_url: paymentUrl,
        order_id: orderId,
        amount: transaction.amount,
      },
    });
  } catch (error) {
    logger.error("生成支付二维码失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 处理支付回调/通知
 * POST /api/payment/webhook
 */
router.post("/webhook", async (req, res) => {
  const dbTransaction = await require("../config/database").transaction();

  try {
    const { order_id, status, amount, transaction_id, payment_method, signature, timestamp } =
      req.body;

    // 验证签名（这里应该根据实际支付服务提供商的签名验证方法）
    const expectedSignature = crypto
      .createHmac("sha256", process.env.PAYMENT_SECRET || "default_secret")
      .update(`${order_id}${status}${amount}${timestamp}`)
      .digest("hex");

    if (signature && signature !== expectedSignature) {
      logger.warn("支付回调签名验证失败:", {
        order_id,
        signature,
        expectedSignature,
      });
      return res.status(400).json({
        success: false,
        error: "签名验证失败",
      });
    }

    // 查找交易记录
    const transaction = await Transaction.findOne({
      where: {
        reference_id: order_id,
        reference_type: "payment",
      },
      transaction: dbTransaction,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "支付订单不存在",
      });
    }

    // 检查交易状态
    if (transaction.status !== "pending") {
      logger.warn("重复的支付回调:", {
        order_id,
        current_status: transaction.status,
      });
      return res.json({
        success: true,
        message: "订单已处理",
      });
    }

    // 验证金额
    if (parseFloat(amount) !== transaction.amount) {
      logger.error("支付金额不匹配:", {
        order_id,
        expected: transaction.amount,
        received: amount,
      });
      return res.status(400).json({
        success: false,
        error: "支付金额不匹配",
      });
    }

    if (status === "success" || status === "completed") {
      // 支付成功，更新用户余额
      const user = await User.findByPk(transaction.user_id, {
        transaction: dbTransaction,
      });

      if (!user) {
        throw new Error("用户不存在");
      }

      // 更新用户余额
      await user.update(
        {
          balance: user.balance + transaction.amount,
          total_recharged: user.total_recharged + transaction.amount,
        },
        { transaction: dbTransaction }
      );

      // 更新交易状态
      await transaction.update(
        {
          status: "completed",
          metadata: {
            ...transaction.metadata,
            transaction_id,
            payment_method,
            completed_at: new Date(),
          },
        },
        { transaction: dbTransaction }
      );

      await dbTransaction.commit();

      logger.info("支付成功处理:", {
        userId: user.id,
        orderId: order_id,
        amount: transaction.amount,
        newBalance: user.balance + transaction.amount,
      });

      // 发送WebSocket通知（如果用户在线）
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${user.id}`).emit("payment_success", {
          order_id,
          amount: transaction.amount,
          new_balance: user.balance + transaction.amount,
        });
      }

      // 调用用户设置的webhook（如果有）
      if (transaction.metadata?.webhook_url) {
        try {
          await fetch(transaction.metadata.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event: "payment_success",
              order_id,
              amount: transaction.amount,
              user_id: user.id,
              timestamp: new Date().toISOString(),
            }),
          });
        } catch (webhookError) {
          logger.error("调用用户webhook失败:", webhookError);
        }
      }

      res.json({
        success: true,
        message: "支付处理成功",
      });
    } else if (status === "failed" || status === "cancelled") {
      // 支付失败或取消
      await transaction.update(
        {
          status: "failed",
          metadata: {
            ...transaction.metadata,
            transaction_id,
            payment_method,
            failed_at: new Date(),
            failure_reason: status,
          },
        },
        { transaction: dbTransaction }
      );

      await dbTransaction.commit();

      logger.info("支付失败处理:", {
        orderId: order_id,
        status,
      });

      res.json({
        success: true,
        message: "支付状态已更新",
      });
    } else {
      // 未知状态
      logger.warn("未知的支付状态:", { order_id, status });
      await dbTransaction.rollback();

      res.status(400).json({
        success: false,
        error: "未知的支付状态",
      });
    }
  } catch (error) {
    await dbTransaction.rollback();
    logger.error("处理支付回调失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 查询支付状态
 * GET /api/payment/status/:orderId
 */
router.get("/status/:orderId", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // 查找交易记录
    const transaction = await Transaction.findOne({
      where: {
        reference_id: orderId,
        reference_type: "payment",
        user_id: userId,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "支付订单不存在",
      });
    }

    // 检查是否过期（30分钟）
    const isExpired = new Date() - new Date(transaction.created_at) > 30 * 60 * 1000;

    // 如果已过期且状态仍为pending，标记为过期
    if (isExpired && transaction.status === "pending") {
      await transaction.update({ status: "expired" });
    }

    res.json({
      success: true,
      data: {
        order_id: orderId,
        status: isExpired && transaction.status === "pending" ? "expired" : transaction.status,
        amount: transaction.amount,
        description: transaction.description,
        created_at: transaction.created_at,
        is_expired: isExpired,
        metadata: transaction.metadata,
      },
    });
  } catch (error) {
    logger.error("查询支付状态失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 取消支付订单
 * POST /api/payment/:orderId/cancel
 */
router.post("/:orderId/cancel", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // 查找交易记录
    const transaction = await Transaction.findOne({
      where: {
        reference_id: orderId,
        reference_type: "payment",
        user_id: userId,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "支付订单不存在",
      });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "只能取消待支付的订单",
      });
    }

    // 更新交易状态
    await transaction.update({
      status: "cancelled",
      metadata: {
        ...transaction.metadata,
        cancelled_at: new Date(),
        cancelled_by: "user",
      },
    });

    logger.info("用户取消支付订单:", {
      userId,
      orderId,
    });

    res.json({
      success: true,
      message: "支付订单已取消",
    });
  } catch (error) {
    logger.error("取消支付订单失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 获取支付方式列表
 * GET /api/payment/methods
 */
router.get("/methods", authenticateToken, async (req, res) => {
  try {
    // 这里应该根据实际集成的支付服务提供商返回可用的支付方式
    const paymentMethods = [
      {
        id: "alipay",
        name: "支付宝",
        name_en: "Alipay",
        icon: "/icons/alipay.png",
        min_amount: 1,
        max_amount: 10000,
        fee_rate: 0.006, // 0.6%
        available: true,
      },
      {
        id: "wechat",
        name: "微信支付",
        name_en: "WeChat Pay",
        icon: "/icons/wechat.png",
        min_amount: 1,
        max_amount: 10000,
        fee_rate: 0.006, // 0.6%
        available: true,
      },
      {
        id: "paypal",
        name: "PayPal",
        name_en: "PayPal",
        icon: "/icons/paypal.png",
        min_amount: 5,
        max_amount: 5000,
        fee_rate: 0.049, // 4.9%
        available: true,
      },
      {
        id: "crypto_usdt",
        name: "USDT (TRC20)",
        name_en: "USDT (TRC20)",
        icon: "/icons/usdt.png",
        min_amount: 10,
        max_amount: 50000,
        fee_rate: 0.01, // 1%
        available: true,
      },
    ];

    res.json({
      success: true,
      data: paymentMethods,
    });
  } catch (error) {
    logger.error("获取支付方式失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 模拟支付成功（仅开发环境）
 * POST /api/payment/:orderId/simulate-success
 */
router.post("/:orderId/simulate-success", authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      error: "此接口仅在开发环境可用",
    });
  }

  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // 查找交易记录
    const transaction = await Transaction.findOne({
      where: {
        reference_id: orderId,
        reference_type: "payment",
        user_id: userId,
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "支付订单不存在",
      });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "订单状态不是待支付",
      });
    }

    // 模拟支付回调
    const simulatedCallback = {
      order_id: orderId,
      status: "success",
      amount: transaction.amount.toString(),
      transaction_id: `sim_${Date.now()}`,
      payment_method: "simulated",
      timestamp: Date.now().toString(),
    };

    // 调用webhook处理逻辑
    req.body = simulatedCallback;
    return router.handle({ ...req, method: "POST", url: "/webhook" }, res, () => {});
  } catch (error) {
    logger.error("模拟支付失败:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
