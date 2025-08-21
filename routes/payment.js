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
    const { amount, description } = req.body;
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

    // 创建支付订单记录
    const payment = await Transaction.create({
      user_id: userId,
      type: "recharge",
      type_display: "账户充值",
      amount: amount,
      balance_before: user.balance,
      balance_after: user.balance, // 支付成功后更新
      description: description || `用户 ${user.username} 充值 $${amount}`,
      status: "pending",
      reference_id: `PAY_${Date.now()}_${userId}`,
    });

    // 调用 SafePing API 创建支付
    try {
      const safePingResponse = await fetch("https://www.safeping.xyz/api/payment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_name: "SMS验证平台充值",
          description: `用户 ${user.username} 充值 $${amount}`,
          amount: amount,
          webhook_url: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/payment/webhook`,
          language: "zh-CN",
        }),
      });

      const safePingData = await safePingResponse.json();

      if (safePingData.payment_id) {
        // 更新交易记录，保存 SafePing 支付ID
        await payment.update({
          reference_id: safePingData.payment_id,
          metadata: {
            safePingPaymentId: safePingData.payment_id,
            paymentUrl: safePingData.payment_url,
            qrCode: safePingData.qr_code,
            expiresAt: safePingData.expires_at,
          },
        });

        logger.info("支付订单创建成功:", {
          userId,
          amount,
          paymentId: safePingData.payment_id,
        });

        res.json({
          success: true,
          message: "支付订单创建成功",
          data: {
            payment_id: safePingData.payment_id,
            payment_url: safePingData.payment_url,
            qr_code: safePingData.qr_code,
            expires_at: safePingData.expires_at,
            amount: amount,
            transaction_id: payment.id,
          },
        });
      } else {
        throw new Error("SafePing API 返回无效数据");
      }
    } catch (safePingError) {
      logger.error("SafePing API 调用失败:", safePingError);

      // 删除本地交易记录
      await payment.destroy();

      return res.status(500).json({
        success: false,
        error: "支付服务暂时不可用，请稍后重试",
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

module.exports = router;
