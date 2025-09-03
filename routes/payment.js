const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const { User, Transaction } = require("../models");
const { Op } = require("sequelize");

// =================================
// 💳 Payment Creation API Route
// =================================

/**
 * 创建支付订单
 * POST /api/payment/create
 */
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { amount, description, service_name, webhook_url, language } = req.body;
    const userId = req.user.id;

    // 验证金额
    if (!amount || amount < 0.01 || amount > 10000) {
      return res.status(400).json({
        success: false,
        error: "充值金额必须在 $0.01 - $10,000 之间",
      });
    }

    // 获取用户信息
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 调用onetimeping.eu API创建支付订单
    try {
      const safepingResponse = await fetch("https://www.onetimeping.eu/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SAFEPING_API_KEY}`,
        },
        body: JSON.stringify({
          service_name: service_name || "SMS Verification Service",
          description: description || `账户充值 - $${amount}`,
          amount: amount,
          webhook_url:
            webhook_url ||
            `${process.env.SAFEPING_API_URL || process.env.APP_URL || "http://localhost:3001"}/api/webhook/safeping`,
          language: language || "zh-CN",
        }),
      });

      logger.info(
        "Sending to SafePing with webhook_url:",
        webhook_url ||
          `${process.env.SAFEPING_API_URL || process.env.APP_URL || "http://localhost:3001"}/api/webhook/safeping`
      );

      if (!safepingResponse.ok) {
        const errorData = await safepingResponse.json();
        throw new Error(errorData.error || `SafePing API error: ${safepingResponse.status}`);
      }

      const safepingData = await safepingResponse.json();

      logger.info("SafePing API response:", safepingData);

      // 创建本地支付记录
      const payment = await Transaction.create({
        user_id: userId,
        type: "recharge",
        type_display: "账户充值",
        amount: amount,
        balance_before: user.balance,
        balance_after: user.balance,
        description: description || `用户 ${user.username} 充值 $${amount}`,
        status: "pending",
        reference_id: safepingData.payment_id,
        metadata: {
          safeping_payment_id: safepingData.payment_id,
          payment_url: safepingData.payment_url,
          qr_code: safepingData.qr_code,
          provider: "onetimeping.eu",
        },
      });

      logger.info("SafePing支付订单创建成功:", {
        userId,
        amount,
        paymentId: safepingData.payment_id,
        safepingData,
      });

      res.json({
        success: true,
        message: "支付订单创建成功",
        data: {
          payment_id: safepingData.payment_id,
          payment_url: safepingData.payment_url,
          qr_code: safepingData.qr_code,
          amount: amount,
          transaction_id: payment.id,
        },
      });
    } catch (safepingError) {
      logger.error("SafePing支付订单创建失败:", safepingError);
      return res.status(500).json({
        success: false,
        error: `支付订单创建失败: ${safepingError.message}`,
      });
    }
  } catch (error) {
    logger.error("创建支付订单失败:", error);
    res.status(500).json({
      success: false,
      error: "创建支付订单失败，请重试",
    });
  }
});

/**
 * 支付回调处理
 * POST /api/payment/webhook
 */
router.post("/webhook", async (req, res) => {
  try {
    const { payment_id, status, amount, service_name, description } = req.body;
    const { user_id } = req.query; // Get user_id from webhook URL

    logger.info("收到SafePing支付回调:", {
      payment_id,
      status,
      amount,
      user_id,
      service_name,
    });

    // 验证支付状态
    if (status !== "completed") {
      logger.info("支付未完成，忽略回调:", { payment_id, status });
      return res.status(200).json({ received: true });
    }

    // 验证用户ID
    if (!user_id) {
      logger.error("缺少用户ID参数:", { payment_id });
      return res.status(400).json({ received: false, error: "Missing user_id" });
    }

    // 获取用户信息
    const user = await User.findByPk(user_id);
    if (!user) {
      logger.error("用户不存在:", { userId: user_id });
      return res.status(200).json({ received: true });
    }

    // 检查是否已经处理过这个支付
    const existingTransaction = await Transaction.findOne({
      where: {
        reference_id: payment_id,
        type: "recharge",
        status: "completed",
      },
    });

    if (existingTransaction) {
      logger.info("支付已处理过，跳过:", { payment_id });
      return res.status(200).json({ received: true });
    }

    // 更新用户余额
    const oldBalance = user.balance;
    const newBalance = oldBalance + amount;

    await user.update({
      balance: newBalance,
      total_recharged: user.total_recharged + amount,
    });

    // 创建交易记录
    const transaction = await Transaction.create({
      user_id: user_id,
      type: "recharge",
      type_display: "充值",
      amount: amount,
      balance_before: oldBalance,
      balance_after: newBalance,
      description: description || `SafePing充值 $${amount}`,
      status: "completed",
      reference_id: payment_id,
      reference_type: "safeping_payment",
      completed_at: new Date(),
      metadata: {
        safeping_payment_id: payment_id,
        service_name: service_name,
        processed_at: new Date().toISOString(),
      },
    });

    logger.info("SafePing支付处理成功:", {
      userId: user.id,
      username: user.username,
      amount,
      oldBalance,
      newBalance,
      transactionId: transaction.id,
      paymentId: payment_id,
    });

    // Send WebSocket notification if available
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${user_id}`).emit("payment_success", {
        payment_id,
        amount,
        old_balance: oldBalance,
        new_balance: newBalance,
        transaction_id: transaction.id,
        message: "充值成功！",
      });
      logger.info("发送WebSocket通知:", { userId: user_id });
    }

    res.status(200).json({
      received: true,
      processed: true,
      transaction_id: transaction.id,
      new_balance: newBalance,
    });
  } catch (error) {
    logger.error("处理SafePing支付回调失败:", error);
    res.status(500).json({ received: false, error: error.message });
  }
});

/**
 * 获取支付历史
 * GET /api/payment/history
 */
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows } = await Transaction.findAndCountAll({
      where: {
        user_id: userId,
        type: "recharge",
      },
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error("获取支付历史失败:", error);
    res.status(500).json({
      success: false,
      error: "获取支付历史失败",
    });
  }
});

/**
 * 获取支付状态 (通过 SafePing Payment ID)
 * GET /api/payment/status/:paymentId
 */
router.get("/status/:paymentId", authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    // Check our local transaction record first
    const transaction = await Transaction.findOne({
      where: {
        reference_id: paymentId,
        user_id: userId,
        type: "recharge",
      },
    });

    if (transaction) {
      return res.json({
        success: true,
        data: {
          status: transaction.status,
          amount: transaction.amount,
          created_at: transaction.created_at,
          completed_at: transaction.completed_at,
          source: "local",
        },
      });
    }

    // If no local record, return pending status
    res.json({
      success: true,
      data: {
        status: "pending",
        payment_id: paymentId,
        source: "safeping",
      },
    });
  } catch (error) {
    logger.error("获取支付状态失败:", error);
    res.status(500).json({
      success: false,
      error: "获取支付状态失败",
    });
  }
});

/**
 * 检查待处理支付 (用于页面恢复)
 * GET /api/payment/check-pending
 */
router.get("/check-pending", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get recent transactions for this user
    const recentTransactions = await Transaction.findAll({
      where: {
        user_id: userId,
        type: "recharge",
        status: "completed",
        created_at: {
          [Op.gte]: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
        },
      },
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    res.json({
      success: true,
      data: {
        recent_payments: recentTransactions.map((t) => ({
          payment_id: t.reference_id,
          amount: t.amount,
          status: t.status,
          completed_at: t.completed_at,
        })),
      },
    });
  } catch (error) {
    logger.error("检查待处理支付失败:", error);
    res.status(500).json({
      success: false,
      error: "检查待处理支付失败",
    });
  }
});

/**
 * 手动确认支付完成
 * POST /api/payment/confirm
 */
router.post("/confirm", authenticateToken, async (req, res) => {
  try {
    const { payment_id, amount } = req.body;
    const userId = req.user.id;

    // 验证参数
    if (!payment_id || !amount) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数",
      });
    }

    // 查找待处理的支付订单
    const transaction = await Transaction.findOne({
      where: {
        reference_id: payment_id,
        user_id: userId,
        type: "recharge",
        status: "pending",
      },
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "支付订单不存在或已处理",
      });
    }

    // 获取用户信息
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 更新用户余额
    const oldBalance = user.balance;
    const newBalance = oldBalance + parseFloat(amount);

    await user.update({
      balance: newBalance,
      total_recharged: user.total_recharged + parseFloat(amount),
    });

    // 更新交易记录状态
    await transaction.update({
      status: "completed",
      balance_after: newBalance,
      completed_at: new Date(),
      metadata: {
        ...transaction.metadata,
        manually_confirmed: true,
        confirmed_at: new Date().toISOString(),
      },
    });

    logger.info("手动确认支付成功:", {
      userId,
      paymentId: payment_id,
      amount,
      oldBalance,
      newBalance,
      transactionId: transaction.id,
    });

    // Send WebSocket notification if available
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${userId}`).emit("payment_success", {
        payment_id,
        amount: parseFloat(amount),
        old_balance: oldBalance,
        new_balance: newBalance,
        transaction_id: transaction.id,
        message: "充值成功！",
      });
      logger.info("发送WebSocket通知:", { userId });
    }

    res.json({
      success: true,
      message: "支付确认成功",
      data: {
        payment_id,
        amount: parseFloat(amount),
        old_balance: oldBalance,
        new_balance: newBalance,
        transaction_id: transaction.id,
      },
    });
  } catch (error) {
    logger.error("手动确认支付失败:", error);
    res.status(500).json({
      success: false,
      error: "支付确认失败，请重试",
    });
  }
});

module.exports = router;
