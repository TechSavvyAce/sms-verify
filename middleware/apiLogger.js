const {
  logApiAccess,
  logSecurityEvent,
  logPerformance,
  enhanceError,
} = require("../utils/advancedLogger");
const logger = require("../utils/logger");

/**
 * API请求/响应日志中间件
 */
const apiLogger = (req, res, next) => {
  const startTime = Date.now();

  // 记录请求开始
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  // 记录请求信息
  const requestLog = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    contentType: req.get("Content-Type"),
    contentLength: req.get("Content-Length"),
    authorization: req.get("Authorization") ? "Bearer ***" : undefined,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  };

  // 在开发环境记录请求体（排除敏感信息）
  if (process.env.NODE_ENV === "development" && req.body) {
    requestLog.body = sanitizeRequestBody(req.body);
  }

  logger.debug("API请求开始", requestLog);

  // 监听响应完成
  const originalSend = res.send;
  res.send = function (data) {
    const responseTime = Date.now() - startTime;

    // 记录响应信息
    const responseLog = {
      requestId,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get("Content-Length"),
      contentType: res.get("Content-Type"),
    };

    // 记录API访问日志
    logApiAccess(req, res, responseTime);

    // 性能监控
    if (responseTime > 1000) {
      logPerformance(`API_${req.method}_${req.route?.path || req.originalUrl}`, responseTime, {
        statusCode: res.statusCode,
        userId: req.user?.id,
      });
    }

    // 检测可疑活动
    detectSuspiciousActivity(req, res, responseTime);

    logger.debug("API请求完成", responseLog);

    return originalSend.call(this, data);
  };

  next();
};

/**
 * 清理请求体中的敏感信息
 */
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== "object") return body;

  const sanitized = { ...body };
  const sensitiveFields = [
    "password",
    "confirmPassword",
    "currentPassword",
    "newPassword",
    "token",
    "api_key",
    "secret",
  ];

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = "***";
    }
  });

  return sanitized;
};

/**
 * 检测可疑活动
 */
const detectSuspiciousActivity = (req, res, responseTime) => {
  const suspiciousIndicators = [];

  // 检测SQL注入尝试
  const sqlInjectionPatterns =
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b)/i;
  const queryString = req.originalUrl.toLowerCase();
  if (sqlInjectionPatterns.test(queryString)) {
    suspiciousIndicators.push("可能的SQL注入尝试");
  }

  // 检测XSS尝试
  const xssPatterns = /(<script|javascript:|onload=|onerror=)/i;
  if (req.body && typeof req.body === "object") {
    const bodyString = JSON.stringify(req.body).toLowerCase();
    if (xssPatterns.test(bodyString)) {
      suspiciousIndicators.push("可能的XSS攻击尝试");
    }
  }

  // 检测过多的404请求
  if (res.statusCode === 404) {
    checkFor404Abuse(req.ip);
  }

  // 检测异常慢的请求
  if (responseTime > 30000) {
    suspiciousIndicators.push("异常慢的请求响应");
  }

  // 检测大量401/403错误
  if (res.statusCode === 401 || res.statusCode === 403) {
    checkForAuthAbuse(req.ip, req.user?.id);
  }

  // 记录可疑活动
  if (suspiciousIndicators.length > 0) {
    logSecurityEvent(
      "可疑API活动",
      {
        indicators: suspiciousIndicators,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get("User-Agent"),
        userId: req.user?.id,
        statusCode: res.statusCode,
        responseTime,
      },
      "warn"
    );
  }
};

/**
 * 404滥用检测缓存
 */
const notFoundAttempts = new Map();

const checkFor404Abuse = (ip) => {
  const key = `404_${ip}`;
  const attempts = notFoundAttempts.get(key) || 0;
  const newAttempts = attempts + 1;

  notFoundAttempts.set(key, newAttempts);

  // 5分钟内超过20次404请求认为可疑
  if (newAttempts > 20) {
    logSecurityEvent(
      "404滥用检测",
      {
        ip,
        attempts: newAttempts,
      },
      "warn"
    );

    // 重置计数器
    notFoundAttempts.delete(key);
  }

  // 清理过期记录
  setTimeout(
    () => {
      notFoundAttempts.delete(key);
    },
    5 * 60 * 1000
  ); // 5分钟
};

/**
 * 认证滥用检测缓存
 */
const authFailureAttempts = new Map();

const checkForAuthAbuse = (ip, userId) => {
  const key = `auth_fail_${ip}`;
  const attempts = authFailureAttempts.get(key) || 0;
  const newAttempts = attempts + 1;

  authFailureAttempts.set(key, newAttempts);

  // 15分钟内超过10次认证失败认为可疑
  if (newAttempts > 10) {
    logSecurityEvent(
      "认证滥用检测",
      {
        ip,
        userId,
        attempts: newAttempts,
      },
      "error"
    );

    // 重置计数器
    authFailureAttempts.delete(key);
  }

  // 清理过期记录
  setTimeout(
    () => {
      authFailureAttempts.delete(key);
    },
    15 * 60 * 1000
  ); // 15分钟
};

/**
 * 错误详情记录中间件
 */
const errorDetailsLogger = (err, req, res, next) => {
  if (err) {
    const enhancedError = enhanceError(err, { req });

    logger.error("API错误详情", {
      requestId: req.requestId,
      error: enhancedError,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
    });
  }

  next(err);
};

/**
 * 请求大小监控中间件
 */
const requestSizeMonitor = (maxSize = 10 * 1024 * 1024) => {
  // 默认10MB
  return (req, res, next) => {
    const contentLength = parseInt(req.get("Content-Length") || "0");

    if (contentLength > maxSize) {
      logSecurityEvent(
        "请求体过大",
        {
          ip: req.ip,
          url: req.originalUrl,
          contentLength,
          maxSize,
          userId: req.user?.id,
        },
        "warn"
      );

      return res.status(413).json({
        success: false,
        error: {
          message: "请求体过大",
          code: "PAYLOAD_TOO_LARGE",
          maxSize: `${Math.round(maxSize / 1024 / 1024)}MB`,
        },
      });
    }

    next();
  };
};

/**
 * 用户活动跟踪中间件
 */
const userActivityTracker = (req, res, next) => {
  if (req.user && req.method !== "GET") {
    const originalSend = res.send;
    res.send = function (data) {
      // 只记录成功的非GET请求
      if (res.statusCode < 400) {
        const { logUserActivity } = require("../utils/advancedLogger");
        logUserActivity(req.user.id, `${req.method}_${req.route?.path || req.originalUrl}`, {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          statusCode: res.statusCode,
        });
      }

      return originalSend.call(this, data);
    };
  }

  next();
};

/**
 * 清理监控缓存的定时任务
 */
const startCleanupTask = () => {
  setInterval(() => {
    // 清理404尝试缓存
    const now = Date.now();
    for (const [key, timestamp] of notFoundAttempts.entries()) {
      if (now - timestamp > 5 * 60 * 1000) {
        // 5分钟
        notFoundAttempts.delete(key);
      }
    }

    // 清理认证失败尝试缓存
    for (const [key, timestamp] of authFailureAttempts.entries()) {
      if (now - timestamp > 15 * 60 * 1000) {
        // 15分钟
        authFailureAttempts.delete(key);
      }
    }
  }, 60 * 1000); // 每分钟清理一次
};

// 启动清理任务
startCleanupTask();

module.exports = {
  apiLogger,
  errorDetailsLogger,
  requestSizeMonitor,
  userActivityTracker,
  sanitizeRequestBody,
  detectSuspiciousActivity,
};
