const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const logger = require("../utils/logger");
const { rateLimitHandler } = require("./errorHandler");

/**
 * 基础速率限制配置
 */
const createBasicLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        message: "请求频率过高，请稍后重试",
        code: "RATE_LIMIT_ERROR",
        retryAfter: Math.round(windowMs / 1000),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
};

/**
 * 严格的认证限制器
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 15分钟内最多5次登录尝试
  message: {
    success: false,
    error: {
      message: "登录尝试次数过多，请15分钟后重试",
      code: "AUTH_RATE_LIMIT_ERROR",
      retryAfter: 900, // 15分钟
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // 成功的请求不计入限制
  // onLimitReached removed in express-rate-limit v7 - use handler instead
});

/**
 * API调用限制器
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 60, // 每分钟60次请求
  message: {
    success: false,
    error: {
      message: "API调用频率过高，请稍后重试",
      code: "API_RATE_LIMIT_ERROR",
      retryAfter: 60,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // 对认证用户使用用户ID，否则使用IP
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  },
});

/**
 * 购买操作限制器
 */
const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 每分钟最多5次购买操作
  message: {
    success: false,
    error: {
      message: "购买操作频率过高，请稍后重试",
      code: "PURCHASE_RATE_LIMIT_ERROR",
      retryAfter: 60,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    return req.user?.id ? `purchase_${req.user.id}` : req.ip;
  },
  // onLimitReached removed in express-rate-limit v7 - use handler instead
});

/**
 * 文件上传限制器
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 每分钟最多10次上传
  message: {
    success: false,
    error: {
      message: "文件上传频率过高，请稍后重试",
      code: "UPLOAD_RATE_LIMIT_ERROR",
      retryAfter: 60,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * 邮件发送限制器
 */
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5, // 每小时最多5封邮件
  message: {
    success: false,
    error: {
      message: "邮件发送频率过高，请1小时后重试",
      code: "EMAIL_RATE_LIMIT_ERROR",
      retryAfter: 3600,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // 使用邮箱地址或用户ID作为key
    return req.body?.email || req.user?.email || req.ip;
  },
});

/**
 * 慢速攻击保护
 */
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15分钟
  delayAfter: 50, // 前50个请求正常
  delayMs: () => 500, // 每个后续请求延迟500ms
  maxDelayMs: 20000, // 最大延迟20秒
  // onLimitReached removed in express-slow-down v2 - use global handler instead
});

/**
 * 创建动态限制器
 */
const createDynamicLimiter = (options) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = "请求频率过高",
    keyGenerator = null,
    skipIf = null,
  } = options;

  return rateLimit({
    windowMs,
    max: typeof max === "function" ? max : () => max,
    message: {
      success: false,
      error: {
        message,
        code: "RATE_LIMIT_ERROR",
        retryAfter: Math.round(windowMs / 1000),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    keyGenerator,
    skip: skipIf,
  });
};

/**
 * IP白名单跳过限制
 */
const skipTrustedIPs = (req) => {
  const trustedIPs = process.env.TRUSTED_IPS?.split(",") || [];
  return trustedIPs.includes(req.ip);
};

/**
 * 管理员跳过限制
 */
const skipForAdmins = (req) => {
  return req.user?.role === "admin";
};

/**
 * 组合多个限制器
 */
const combineLimiters = (...limiters) => {
  return (req, res, next) => {
    const runLimiter = (index) => {
      if (index >= limiters.length) {
        return next();
      }

      limiters[index](req, res, (err) => {
        if (err) {
          return next(err);
        }
        runLimiter(index + 1);
      });
    };

    runLimiter(0);
  };
};

/**
 * 条件限制器
 */
const conditionalLimiter = (condition, limiter) => {
  return (req, res, next) => {
    if (condition(req)) {
      return limiter(req, res, next);
    }
    next();
  };
};

/**
 * 基于用户等级的动态限制
 */
const userTierLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: (req) => {
    if (!req.user) return 10; // 未认证用户

    // 根据用户等级设置不同限制
    const userTiers = {
      admin: 1000,
      premium: 200,
      standard: 60,
      basic: 30,
    };

    return userTiers[req.user.tier] || userTiers.basic;
  },
  message: {
    success: false,
    error: {
      message: "API调用频率过高，考虑升级账户获得更高限额",
      code: "USER_TIER_RATE_LIMIT_ERROR",
    },
  },
  keyGenerator: (req) => {
    return req.user?.id ? `tier_${req.user.id}` : req.ip;
  },
});

/**
 * 获取限制器状态
 */
const getLimiterStatus = (req, limiterName = "default") => {
  const limit = req.rateLimit;
  if (!limit) return null;

  return {
    limiter: limiterName,
    limit: limit.limit,
    current: limit.current,
    remaining: limit.remaining,
    resetTime: new Date(Date.now() + limit.resetTime),
    windowMs: limit.windowMs,
  };
};

module.exports = {
  // 预定义限制器
  createBasicLimiter,
  authLimiter,
  apiLimiter,
  purchaseLimiter,
  uploadLimiter,
  emailLimiter,
  speedLimiter,
  userTierLimiter,

  // 工具函数
  createDynamicLimiter,
  combineLimiters,
  conditionalLimiter,
  skipTrustedIPs,
  skipForAdmins,
  getLimiterStatus,
};
