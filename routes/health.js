const express = require("express");
const router = express.Router();
const SMSActivateService = require("../services/SMSActivateService");
const WebhookService = require("../services/WebhookService");
const EmailService = require("../services/EmailService");
const logger = require("../utils/logger");
const { authenticateToken } = require("../middleware/auth");

const smsService = new SMSActivateService();
const webhookService = new WebhookService();
const emailService = new EmailService();

/**
 * 系统健康检查总览
 * GET /api/health
 */
router.get("/", async (req, res) => {
  try {
    const startTime = Date.now();

    // 基本系统信息
    const systemHealth = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
      services: {},
    };

    // 测试数据库连接
    try {
      const db = require("../config/database");
      await db.authenticate();
      systemHealth.services.database = {
        status: "healthy",
        message: "数据库连接正常",
      };
    } catch (error) {
      systemHealth.services.database = {
        status: "unhealthy",
        message: "数据库连接失败",
        error: error.message,
      };
      systemHealth.status = "degraded";
    }

    // 测试SMS-Activate API
    try {
      const smsHealth = await smsService.testConnection();
      systemHealth.services.smsActivate = {
        status: smsHealth.success ? "healthy" : "unhealthy",
        ...smsHealth,
      };

      if (!smsHealth.success) {
        systemHealth.status = "degraded";
      }
    } catch (error) {
      systemHealth.services.smsActivate = {
        status: "unhealthy",
        message: "SMS-Activate API测试失败",
        error: error.message,
      };
      systemHealth.status = "degraded";
    }

    // 测试邮件服务
    try {
      const emailHealth = await emailService.testConnection();
      systemHealth.services.email = {
        status: emailHealth.success ? "healthy" : "unhealthy",
        message: emailHealth.message,
      };

      if (!emailHealth.success) {
        systemHealth.status = "degraded";
      }
    } catch (error) {
      systemHealth.services.email = {
        status: "unhealthy",
        message: "邮件服务测试失败",
        error: error.message,
      };
    }

    // Webhook服务状态
    systemHealth.services.webhooks = {
      status: "healthy",
      message: "Webhook服务正常运行",
      endpoints: ["/api/webhook/rental", "/api/webhook/payment", "/api/webhook/activation"],
    };

    const responseTime = Date.now() - startTime;
    systemHealth.responseTime = `${responseTime}ms`;

    // 根据整体状态设置HTTP状态码
    const httpStatus =
      systemHealth.status === "healthy" ? 200 : systemHealth.status === "degraded" ? 207 : 503;

    res.status(httpStatus).json({
      success: true,
      data: systemHealth,
    });
  } catch (error) {
    logger.error("健康检查失败:", error);
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "系统健康检查失败",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * SMS-Activate 服务详细健康检查
 * GET /api/health/sms-activate
 */
router.get("/sms-activate", authenticateToken, async (req, res) => {
  try {
    const healthData = await smsService.getHealthStatus();

    res.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    logger.error("SMS-Activate健康检查失败:", error);
    res.status(503).json({
      success: false,
      message: "SMS-Activate健康检查失败",
      error: error.message,
    });
  }
});

/**
 * SMS-Activate API权限验证
 * GET /api/health/sms-activate/permissions
 */
router.get("/sms-activate/permissions", authenticateToken, async (req, res) => {
  try {
    const permissions = await smsService.validateApiPermissions();

    const httpStatus = permissions.valid ? 200 : 403;

    res.status(httpStatus).json({
      success: permissions.valid,
      data: permissions,
    });
  } catch (error) {
    logger.error("SMS-Activate权限检查失败:", error);
    res.status(503).json({
      success: false,
      message: "权限检查失败",
      error: error.message,
    });
  }
});

/**
 * 获取SMS-Activate服务统计信息
 * GET /api/health/sms-activate/stats
 */
router.get("/sms-activate/stats", authenticateToken, async (req, res) => {
  try {
    const stats = smsService.getServiceStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("获取SMS-Activate统计失败:", error);
    res.status(500).json({
      success: false,
      message: "获取统计信息失败",
      error: error.message,
    });
  }
});

/**
 * 重置SMS-Activate请求计数器
 * POST /api/health/sms-activate/reset-counter
 */
router.post("/sms-activate/reset-counter", authenticateToken, async (req, res) => {
  try {
    smsService.resetRequestCounter();

    res.json({
      success: true,
      message: "请求计数器已重置",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("重置计数器失败:", error);
    res.status(500).json({
      success: false,
      message: "重置计数器失败",
      error: error.message,
    });
  }
});

/**
 * 数据库健康检查
 * GET /api/health/database
 */
router.get("/database", authenticateToken, async (req, res) => {
  try {
    const startTime = Date.now();
    const db = require("../config/database");

    // 测试连接
    await db.authenticate();

    // 测试查询
    const [results] = await db.query("SELECT 1 as test");

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        status: "healthy",
        message: "数据库连接正常",
        responseTime: `${responseTime}ms`,
        testQuery: results[0],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("数据库健康检查失败:", error);
    res.status(503).json({
      success: false,
      status: "unhealthy",
      message: "数据库连接失败",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * 邮件服务健康检查
 * GET /api/health/email
 */
router.get("/email", authenticateToken, async (req, res) => {
  try {
    const healthData = await emailService.testConnection();

    const httpStatus = healthData.success ? 200 : 503;

    res.status(httpStatus).json({
      success: healthData.success,
      data: healthData,
    });
  } catch (error) {
    logger.error("邮件服务健康检查失败:", error);
    res.status(503).json({
      success: false,
      message: "邮件服务检查失败",
      error: error.message,
    });
  }
});

/**
 * Webhook服务健康检查
 * GET /api/health/webhooks
 */
router.get("/webhooks", authenticateToken, async (req, res) => {
  try {
    const healthData = {
      status: "healthy",
      message: "Webhook服务正常运行",
      timestamp: new Date().toISOString(),
      endpoints: [
        {
          path: "/api/webhook/rental",
          method: "POST",
          description: "租用状态更新webhook",
        },
        {
          path: "/api/webhook/payment",
          method: "POST",
          description: "支付状态更新webhook",
        },
        {
          path: "/api/webhook/activation",
          method: "POST",
          description: "激活状态更新webhook",
        },
        {
          path: "/api/webhook/config",
          method: "GET",
          description: "获取webhook配置",
        },
        {
          path: "/api/webhook/test",
          method: "POST",
          description: "测试webhook连接",
        },
      ],
      security: {
        signatureValidation: "HMAC-SHA256",
        secretSource: "WEBHOOK_SECRET环境变量",
      },
    };

    res.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    logger.error("Webhook健康检查失败:", error);
    res.status(500).json({
      success: false,
      message: "Webhook健康检查失败",
      error: error.message,
    });
  }
});

module.exports = router;
