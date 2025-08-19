const jwt = require("jsonwebtoken");
const { User } = require("../models");
const logger = require("../utils/logger");

/**
 * 验证JWT令牌
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "访问令牌缺失",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 获取用户信息
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "用户不存在",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        error: "账户已被停用",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("令牌验证失败:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "令牌已过期",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "令牌无效",
        code: "TOKEN_INVALID",
      });
    }

    return res.status(500).json({
      success: false,
      error: "服务器内部错误",
    });
  }
};

/**
 * 可选的令牌验证（不强制要求登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId);

      if (user && user.status === "active") {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // 可选验证失败不阻止请求
    next();
  }
};

/**
 * 管理员权限验证
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "需要登录",
      });
    }

    // 这里可以添加更复杂的角色系统
    // 暂时通过用户ID判断（实际项目中应该有专门的角色表）
    const adminUsers = (process.env.ADMIN_USERS || "1")
      .split(",")
      .map((id) => parseInt(id));

    if (!adminUsers.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: "需要管理员权限",
      });
    }

    next();
  } catch (error) {
    logger.error("管理员权限验证失败:", error);
    return res.status(500).json({
      success: false,
      error: "服务器内部错误",
    });
  }
};

/**
 * 用户活动记录中间件
 */
const logUserActivity = (action) => {
  return (req, res, next) => {
    // 记录用户活动
    if (req.user) {
      const activityData = {
        userId: req.user.id,
        action,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        details: {
          method: req.method,
          url: req.url,
          params: req.params,
          query: req.query,
        },
      };

      // 异步记录，不阻塞请求
      setImmediate(() => {
        logger.info("用户活动:", activityData);
        // 这里可以保存到数据库或发送到分析服务
      });
    }

    next();
  };
};

/**
 * API密钥验证（用于系统间通信）
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const validApiKeys = (process.env.INTERNAL_API_KEYS || "").split(",");

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: "API密钥无效",
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  logUserActivity,
  authenticateApiKey,
};
