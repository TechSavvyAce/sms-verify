const express = require("express");
const router = express.Router();
const WebhookService = require("../services/WebhookService");
const logger = require("../utils/logger");
const crypto = require("crypto");

const webhookService = new WebhookService();

/**
 * 通用webhook验证中间件
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers["x-webhook-signature"] || req.headers["x-signature"];
    const secret = req.query.secret || req.headers["x-webhook-secret"];

    if (!signature) {
      return res.status(401).json({
        success: false,
        error: "缺少webhook签名",
      });
    }

    const payload = JSON.stringify(req.body);
    const isValid = webhookService.verifySignature(payload, signature, secret);

    if (!isValid) {
      logger.warn("Webhook签名验证失败", {
        signature,
        payload: payload.substring(0, 100),
      });
      return res.status(401).json({
        success: false,
        error: "Webhook签名验证失败",
      });
    }

    next();
  } catch (error) {
    logger.error("Webhook验证错误:", error);
    res.status(500).json({
      success: false,
      error: "Webhook验证处理失败",
    });
  }
};

/**
 * 租用状态更新webhook
 * POST /api/webhook/rental
 */
router.post("/rental", verifyWebhookSignature, async (req, res) => {
  try {
    logger.info("收到租用webhook:", req.body);

    const result = await webhookService.handleRentalWebhook(req.body);

    res.json({
      success: true,
      message: result.message,
      data: {
        rental_id: result.rental_id,
        updates: result.updates,
      },
    });
  } catch (error) {
    logger.error("租用webhook处理失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "租用webhook处理失败",
    });
  }
});

/**
 * 支付状态更新webhook
 * POST /api/webhook/payment
 */
router.post("/payment", verifyWebhookSignature, async (req, res) => {
  try {
    logger.info("收到支付webhook:", req.body);

    const result = await webhookService.handlePaymentWebhook(req.body);

    res.json({
      success: true,
      message: result.message,
      data: {
        transaction_id: result.transaction_id,
        status: result.status,
      },
    });
  } catch (error) {
    logger.error("支付webhook处理失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "支付webhook处理失败",
    });
  }
});

/**
 * Safeping.xyz支付状态更新webhook
 * POST /api/webhook/safeping
 */
router.post("/safeping", async (req, res) => {
  try {
    logger.info("收到Safeping.xyz webhook:", req.body);

    // 验证Safeping.xyz webhook签名
    const signature = req.headers["x-safeping-signature"];
    const webhookSecret = process.env.SAFEPING_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      if (signature !== expectedSignature) {
        logger.warn("Safeping.xyz webhook签名验证失败", {
          received: signature,
          expected: expectedSignature,
        });
        return res.status(401).json({
          success: false,
          error: "Webhook签名验证失败",
        });
      }
    }

    const result = await webhookService.handleSafepingWebhook(req.body);

    res.json({
      success: true,
      message: result.message,
      data: {
        payment_id: result.payment_id,
        status: result.status,
        amount: result.amount,
      },
    });
  } catch (error) {
    logger.error("Safeping.xyz webhook处理失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Safeping.xyz webhook处理失败",
    });
  }
});

/**
 * 激活状态更新webhook
 * POST /api/webhook/activation
 */
router.post("/activation", verifyWebhookSignature, async (req, res) => {
  try {
    logger.info("收到激活webhook:", req.body);

    const result = await webhookService.handleActivationWebhook(req.body);

    res.json({
      success: true,
      message: result.message,
      data: {
        activation_id: result.activation_id,
        updates: result.updates,
      },
    });
  } catch (error) {
    logger.error("激活webhook处理失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "激活webhook处理失败",
    });
  }
});

/**
 * SMS-Activate特定格式的webhook (用于兼容)
 * POST /api/webhook/sms-activate
 */
router.post("/sms-activate", async (req, res) => {
  try {
    logger.info("收到SMS-Activate webhook:", req.body);

    const { action, data } = req.body;
    let result;

    switch (action) {
      case "rental_update":
        result = await webhookService.handleRentalWebhook(data);
        break;
      case "activation_update":
        result = await webhookService.handleActivationWebhook(data);
        break;
      case "payment_update":
        result = await webhookService.handlePaymentWebhook(data);
        break;
      default:
        throw new Error(`未知的webhook动作: ${action}`);
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error("SMS-Activate webhook处理失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Webhook处理失败",
    });
  }
});

/**
 * 获取webhook配置信息
 * GET /api/webhook/config
 */
router.get("/config", async (req, res) => {
  try {
    const { type } = req.query;

    if (!type || !["rental", "payment", "activation"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "请指定有效的webhook类型: rental, payment, activation",
      });
    }

    const config = webhookService.generateWebhookUrl(type);

    res.json({
      success: true,
      data: {
        webhook_url: config.url,
        webhook_secret: config.secret,
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": "sha256={signature}",
        },
        instructions: {
          en: "Include the webhook signature in X-Webhook-Signature header using HMAC-SHA256",
          zh: "在X-Webhook-Signature头中包含使用HMAC-SHA256生成的webhook签名",
        },
      },
    });
  } catch (error) {
    logger.error("获取webhook配置失败:", error);
    res.status(500).json({
      success: false,
      error: "获取webhook配置失败",
    });
  }
});

/**
 * 测试webhook连接
 * POST /api/webhook/test
 */
router.post("/test", async (req, res) => {
  try {
    const { url, payload, secret } = req.body;

    if (!url || !payload || !secret) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数: url, payload, secret",
      });
    }

    const result = await webhookService.testWebhook(url, payload, secret);

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    logger.error("测试webhook失败:", error);
    res.status(500).json({
      success: false,
      error: "测试webhook失败",
    });
  }
});

/**
 * Webhook健康检查
 * GET /api/webhook/health
 */
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Webhook服务正常运行",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /api/webhook/rental",
      "POST /api/webhook/payment",
      "POST /api/webhook/activation",
      "POST /api/webhook/sms-activate",
      "POST /api/webhook/safeping",
      "GET /api/webhook/config",
      "POST /api/webhook/test",
    ],
  });
});

module.exports = router;
