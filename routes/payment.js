const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const logger = require("../utils/logger");
const { User, Transaction } = require("../models");
const { Op } = require("sequelize");
const { checkPaymentStatus } = require("../utils/helpers");

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
        amount: amount,
        balance_before: user.balance,
        balance_after: user.balance,
        description: description || `用户 ${user.username} 充值 $${amount}`,
        status: "pending",
        reference_id: safepingData.payment_id,
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

    // 首先检查并过期旧的待处理交易（超过24小时）
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredTransactions = await Transaction.findAll({
      where: {
        user_id: userId,
        type: "recharge",
        status: "pending",
        created_at: {
          [Op.lt]: twentyFourHoursAgo,
        },
      },
    });

    if (expiredTransactions.length > 0) {
      await Transaction.update(
        { status: "expired" },
        {
          where: {
            user_id: userId,
            type: "recharge",
            status: "pending",
            created_at: {
              [Op.lt]: twentyFourHoursAgo,
            },
          },
        }
      );

      // Send WebSocket notification for expired transactions
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${userId}`).emit("payment_expired", {
          expired_count: expiredTransactions.length,
          message: `有 ${expiredTransactions.length} 个支付订单已过期`,
          transactions: expiredTransactions.map((t) => ({
            id: t.id,
            amount: t.amount,
            created_at: t.created_at,
          })),
          timestamp: new Date().toISOString(),
        });
      }
    }

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

    // 检查交易是否已过期（超过24小时）
    const thiryminut = new Date(Date.now() - 30 * 60 * 1000);
    if (transaction.created_at < thiryminut) {
      // 将过期交易标记为expired
      await transaction.update({ status: "expired" });
      return res.status(400).json({
        success: false,
        error: "支付订单已过期，无法确认",
      });
    }

    // 验证支付状态 - 检查OneTimePing API
    const paymentStatusResult = await checkPaymentStatus(payment_id);
    if (!paymentStatusResult.success) {
      return res.status(400).json({
        success: false,
        error: "无法验证支付状态，请稍后重试",
      });
    }

    const paymentData = paymentStatusResult.data;
    if (!paymentData.success || !paymentData.payment) {
      return res.status(400).json({
        success: false,
        error: "支付订单不存在或状态异常",
      });
    }

    const payment = paymentData.payment;

    // 如果支付尚未完成，不允许手动确认
    if (payment.status !== "completed" && payment.status !== "paid") {
      return res.status(400).json({
        success: false,
        error: `支付尚未完成，当前状态: ${payment.status}`,
      });
    }

    // 验证支付金额
    if (parseFloat(payment.amount) !== parseFloat(amount)) {
      return res.status(400).json({
        success: false,
        error: "支付金额不匹配",
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
        timestamp: new Date().toISOString(),
        type: "recharge",
        status: "completed",
      });

      // Also send balance update event
      io.to(`user_${userId}`).emit("balance_updated", {
        new_balance: newBalance,
        change_amount: parseFloat(amount),
        description: "手动确认充值",
        transaction_id: transaction.id,
        timestamp: new Date().toISOString(),
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

// 检查支付状态
router.post("/check-status", authenticateToken, async (req, res) => {
  try {
    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        error: "支付ID不能为空",
      });
    }

    // 检查外部支付状态
    const paymentStatusResult = await checkPaymentStatus(payment_id);

    if (!paymentStatusResult.success) {
      return res.status(400).json({
        success: false,
        error: paymentStatusResult.error || "无法检查支付状态",
      });
    }

    const payment = paymentStatusResult.data.payment;

    if (!payment) {
      return res.status(400).json({
        success: false,
        error: "支付数据为空",
      });
    }

    res.json({
      success: true,
      payment: {
        id: payment.payment_id,
        status: payment.status,
        amount: payment.amount,
        currency: "USD", // OneTimePing doesn't return currency, defaulting to USD
        created_at: payment.created_at,
        completed_at: payment.updated_at, // Using updated_at as completed_at
      },
    });
  } catch (error) {
    logger.error("检查支付状态失败:", error);
    res.status(500).json({
      success: false,
      error: "检查支付状态失败，请重试",
    });
  }
});

module.exports = router;
