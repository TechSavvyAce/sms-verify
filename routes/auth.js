const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { User, Transaction } = require("../models");
const {
  validateUserRegistration,
  validateUserLogin,
  createValidationMiddleware,
} = require("../middleware/validation");
const { logUserActivity } = require("../middleware/auth");
const EmailService = require("../services/EmailService");
const logger = require("../utils/logger");
const {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} = require("../middleware/errorHandler");
const router = express.Router();

const emailService = new EmailService();

/**
 * 生成JWT令牌
 */
function generateTokens(userId) {
  const accessToken = jwt.sign({ userId, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "24h",
  });

  const refreshToken = jwt.sign({ userId, type: "refresh" }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  });

  return { accessToken, refreshToken };
}

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post("/register", createValidationMiddleware(validateUserRegistration), async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 检查用户名是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: existingUser.username === username ? "用户名已存在" : "邮箱已被注册",
      });
    }

    // 创建新用户
    const user = await User.create({
      username,
      email,
      password_hash: password, // 密码会在模型的钩子中自动加密
      status: "pending",
      balance: 0.0, // 确保余额字段被设置
      total_spent: 0.0,
      total_recharged: 0.0,
    });

    // 生成邮箱验证令牌
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // 发送验证邮件
    try {
      await emailService.sendEmailVerification(email, username, verificationToken);
      logger.info("验证邮件发送成功:", { userId: user.id, email });
    } catch (emailError) {
      logger.error("验证邮件发送失败:", emailError);
      // 邮件发送失败不影响注册流程
    }

    // 记录注册活动
    logger.info("用户注册成功:", {
      userId: user.id,
      username: user.username,
      email: user.email,
      ip: req.ip,
    });

    // 生成JWT令牌（自动登录）
    const tokens = generateTokens(user.id);

    res.status(201).json({
      success: true,
      message: "注册成功，请检查您的邮箱并点击验证链接激活账户",
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        requires_verification: true,
      },
    });
  } catch (error) {
    logger.error("用户注册失败:", error);
    res.status(500).json({
      success: false,
      error: "注册失败，请稍后重试",
    });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post(
  "/login",
  createValidationMiddleware(validateUserLogin),
  logUserActivity("login"),
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // 查找用户（支持用户名或邮箱登录）
      const user = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email: username }],
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "用户名或密码错误",
        });
      }

      // 验证密码
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: "用户名或密码错误",
        });
      }

      // 检查账户状态
      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          error: "账户已被停用，请联系客服",
        });
      }

      // 更新登录信息
      await user.updateLoginInfo();

      // 生成令牌
      const tokens = generateTokens(user.id);

      // 记录登录活动
      logger.info("用户登录成功:", {
        userId: user.id,
        username: user.username,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({
        success: true,
        message: "登录成功",
        data: {
          user: user.toJSON(),
          ...tokens,
        },
      });
    } catch (error) {
      logger.error("用户登录失败:", error);
      res.status(500).json({
        success: false,
        error: "登录失败，请稍后重试",
      });
    }
  }
);

/**
 * 刷新令牌
 * POST /api/auth/refresh
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: "刷新令牌缺失",
      });
    }

    // 验证刷新令牌
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== "refresh") {
      return res.status(401).json({
        success: false,
        error: "无效的刷新令牌",
      });
    }

    // 获取用户信息
    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        error: "用户不存在或账户已停用",
      });
    }

    // 生成新令牌
    const tokens = generateTokens(user.id);

    res.json({
      success: true,
      message: "令牌刷新成功",
      data: tokens,
    });
  } catch (error) {
    logger.error("令牌刷新失败:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "刷新令牌已过期，请重新登录",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "无效的刷新令牌",
      });
    }

    res.status(500).json({
      success: false,
      error: "令牌刷新失败",
    });
  }
});

/**
 * 注销登录
 * POST /api/auth/logout
 */
router.post("/logout", logUserActivity("logout"), (req, res) => {
  // 由于使用JWT，服务器端无状态，客户端删除令牌即可
  // 如果需要服务器端令牌黑名单，可以在这里添加逻辑

  logger.info("用户注销:", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.json({
    success: true,
    message: "注销成功",
  });
});

/**
 * 发送密码重置邮件
 * POST /api/auth/forgot-password
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // 查找用户
    const user = await User.findOne({ where: { email } });

    // 为了安全，无论用户是否存在都返回成功消息
    if (!user) {
      return res.json({
        success: true,
        message: "如果该邮箱已注册，将收到密码重置邮件",
      });
    }

    // 生成重置令牌
    const resetToken = jwt.sign(
      { userId: user.id, type: "password_reset" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // TODO: 发送重置邮件
    logger.info("密码重置请求:", {
      userId: user.id,
      email: user.email,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: "如果该邮箱已注册，将收到密码重置邮件",
      // 开发环境返回重置令牌
      ...(process.env.NODE_ENV === "development" && { resetToken }),
    });
  } catch (error) {
    logger.error("密码重置请求失败:", error);
    res.status(500).json({
      success: false,
      error: "密码重置请求失败",
    });
  }
});

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // 验证重置令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "password_reset") {
      return res.status(401).json({
        success: false,
        error: "无效的重置令牌",
      });
    }

    // 获取用户
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 更新密码
    user.password_hash = newPassword; // 会在模型钩子中自动加密
    await user.save();

    logger.info("密码重置成功:", {
      userId: user.id,
      email: user.email,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: "密码重置成功",
    });
  } catch (error) {
    logger.error("密码重置失败:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "重置令牌已过期",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "无效的重置令牌",
      });
    }

    res.status(500).json({
      success: false,
      error: "密码重置失败",
    });
  }
});

/**
 * 邮箱验证
 * POST /api/auth/verify-email
 */
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "验证令牌不能为空",
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: {
        email_verification_token: token,
        email_verification_expires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "验证令牌无效或已过期",
      });
    }

    // 验证邮箱
    await user.verifyEmail();

    // 记录验证活动
    logger.info("邮箱验证成功:", {
      userId: user.id,
      email: user.email,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: "邮箱验证成功！您的账户已激活。",
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    logger.error("邮箱验证失败:", error);
    res.status(500).json({
      success: false,
      error: "验证失败，请稍后重试",
    });
  }
});

/**
 * 重新发送验证邮件
 * POST /api/auth/resend-verification
 */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "邮箱地址不能为空",
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: "邮箱已验证，无需重新发送",
      });
    }

    // 生成新的验证令牌
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // 发送验证邮件
    try {
      await emailService.sendEmailVerification(email, user.username, verificationToken);
      logger.info("重新发送验证邮件成功:", { userId: user.id, email });
    } catch (emailError) {
      logger.error("重新发送验证邮件失败:", emailError);
      return res.status(500).json({
        success: false,
        error: "邮件发送失败，请稍后重试",
      });
    }

    res.json({
      success: true,
      message: "验证邮件已重新发送，请检查您的邮箱",
    });
  } catch (error) {
    logger.error("重新发送验证邮件失败:", error);
    res.status(500).json({
      success: false,
      error: "操作失败，请稍后重试",
    });
  }
});

/**
 * 请求密码重置
 * POST /api/auth/forgot-password
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "邮箱地址不能为空",
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      // 为了安全起见，即使用户不存在也返回成功
      return res.json({
        success: true,
        message: "如果该邮箱已注册，您将收到密码重置邮件",
      });
    }

    // 生成密码重置令牌
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // 发送密码重置邮件
    await emailService.sendPasswordReset(email, user.username, resetToken);

    logger.info("发送密码重置邮件:", {
      userId: user.id,
      email,
    });

    res.json({
      success: true,
      message: "如果该邮箱已注册，您将收到密码重置邮件",
    });
  } catch (error) {
    logger.error("密码重置请求失败:", error);
    res.status(500).json({
      success: false,
      error: "请求失败，请稍后重试",
    });
  }
});

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: "重置令牌和新密码不能为空",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "密码长度至少为6个字符",
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: {
        password_reset_token: token,
        password_reset_expires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "重置链接无效或已过期",
      });
    }

    // 重置密码
    await user.resetPassword(password);

    logger.info("用户密码重置成功:", {
      userId: user.id,
      email: user.email,
    });

    res.json({
      success: true,
      message: "密码重置成功，请使用新密码登录",
    });
  } catch (error) {
    logger.error("密码重置失败:", error);
    res.status(500).json({
      success: false,
      error: "重置失败，请稍后重试",
    });
  }
});

module.exports = router;
