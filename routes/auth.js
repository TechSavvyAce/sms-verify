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
    const { username, password } = req.body;

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "用户名已被使用",
      });
    }

    const userData = {
      username,
      password_hash: password, // 密码将在User模型中自动哈希
      status: "pending", // 设置为pending，必须验证后才能激活
      balance: 0.0,
      total_spent: 0.0,
      total_recharged: 0.0,
    };

    const user = await User.create(userData);

    // 记录注册活动
    logger.info("用户注册成功:", {
      userId: user.id,
      username: user.username,
      ip: req.ip,
    });

    const tokens = generateTokens(user.id);

    res.status(201).json({
      success: true,
      message: "注册成功！请选择验证方式完成账户激活。",
      data: {
        user: {
          id: user.id,
          username: user.username,
          status: user.status,
          email_verified: user.email_verified,
          created_at: user.createdAt,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        verification_methods: ["email", "sms"],
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

      // 检查账户状态并提供明确的错误信息
      if (user.status === "pending") {
        return res.status(403).json({
          success: false,
          error: "账户尚未激活，请先完成邮箱或手机验证",
          code: "ACCOUNT_PENDING",
          requiresVerification: true,
          userId: user.id,
        });
      }

      if (user.status === "suspended") {
        return res.status(403).json({
          success: false,
          error: "账户已被停用，请联系客服",
          code: "ACCOUNT_SUSPENDED",
        });
      }

      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          error: "账户状态异常，请联系客服",
          code: "ACCOUNT_INVALID_STATUS",
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

      // Ensure numeric fields are returned as numbers
      const userData = user.toJSON();
      userData.balance = parseFloat(userData.balance) || 0;
      userData.total_spent = parseFloat(userData.total_spent) || 0;
      userData.total_recharged = parseFloat(userData.total_recharged) || 0;

      res.json({
        success: true,
        message: "登录成功",
        data: {
          user: userData,
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
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "验证码不能为空",
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: {
        verification_code: code,
        verification_code_expires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "验证码无效或已过期",
      });
    }

    // 验证邮箱
    await user.verifyEmail();

    // 清除验证码
    user.verification_code = null;
    user.verification_code_expires = null;
    await user.save();

    // 记录验证活动
    logger.info("邮箱验证成功:", {
      userId: user.id,
      email: user.email,
      ip: req.ip,
    });

    // Ensure numeric fields are returned as numbers
    const userData = user.toJSON();
    userData.balance = parseFloat(userData.balance) || 0;
    userData.total_spent = parseFloat(userData.total_spent) || 0;
    userData.total_recharged = parseFloat(userData.total_recharged) || 0;

    res.json({
      success: true,
      message: "邮箱验证成功！您的账户已激活。",
      data: {
        user: userData,
        account_activated: true,
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
 * 发送验证邮件
 * POST /api/auth/send-email-verification
 */
router.post("/send-email-verification", async (req, res) => {
  try {
    const { email, userId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "邮箱地址不能为空",
      });
    }

    let user;

    // 如果提供了userId，优先使用userId查找用户
    if (userId) {
      user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      // 更新用户的邮箱地址
      user.email = email;
      await user.save();
    } else {
      // 否则尝试通过邮箱查找用户
      user = await User.findOne({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: "邮箱已验证，无需重新发送",
      });
    }

    // 生成8位数字验证码
    const verificationCode = Math.floor(10000000 + Math.random() * 90000000).toString();

    // 保存验证码到用户记录（用于验证）
    user.verification_code = verificationCode;
    user.verification_code_expires = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期
    await user.save();

    // 发送验证邮件
    try {
      await emailService.sendEmailVerification(email, user.username, verificationCode);
      logger.info("发送验证邮件成功:", { userId: user.id, email, code: verificationCode });
    } catch (emailError) {
      logger.error("发送验证邮件失败:", emailError);
      return res.status(500).json({
        success: false,
        error: "邮件发送失败，请稍后重试",
      });
    }

    res.json({
      success: true,
      message: "验证邮件已发送，请检查您的邮箱",
    });
  } catch (error) {
    logger.error("发送验证邮件失败:", error);
    res.status(500).json({
      success: false,
      error: "操作失败，请稍后重试",
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

    // 生成8位数字验证码
    const verificationCode = Math.floor(10000000 + Math.random() * 90000000).toString();

    // 保存验证码到用户记录（用于验证）
    user.verification_code = verificationCode;
    user.verification_code_expires = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期
    await user.save();

    // 发送验证邮件
    try {
      await emailService.sendEmailVerification(email, user.username, verificationCode);
      logger.info("重新发送验证邮件成功:", { userId: user.id, email, code: verificationCode });
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
 * 手机号码验证（无需发送SMS）
 * POST /api/auth/verify-phone
 */
router.post("/verify-phone", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "手机号码不能为空",
      });
    }

    // 验证手机号码格式（支持国际格式）
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: "请输入有效的国际手机号码格式（如：+8613800138000）",
      });
    }

    // 查找用户（这里需要从token中获取用户ID）
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "未授权访问",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      if (user.phone_verified) {
        return res.status(400).json({
          success: false,
          error: "手机已验证，无需重新验证",
        });
      }

      // 更新用户手机号码并激活账户
      user.phone = phone;
      user.phone_verified = true;
      user.status = "active";
      await user.save();

      logger.info("手机号码验证成功:", {
        userId: user.id,
        phone: phone,
      });

      res.json({
        success: true,
        message: "手机号码验证成功！账户已激活",
        data: {
          user: {
            id: user.id,
            username: user.username,
            phone: user.phone,
            phone_verified: true,
            status: "active",
          },
        },
      });
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: "Token无效",
      });
    }
  } catch (error) {
    logger.error("手机号码验证失败:", error);
    res.status(500).json({
      success: false,
      error: "验证失败，请稍后重试",
    });
  }
});

/**
 * 设置初始密码
 * POST /api/auth/set-password
 */
router.post("/set-password", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "用户名和密码不能为空",
      });
    }

    // 验证密码强度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "密码长度至少为6个字符",
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 检查用户是否已经设置过密码
    if (user.password_hash) {
      return res.status(400).json({
        success: false,
        error: "用户已经设置过密码，请使用修改密码功能",
      });
    }

    // 设置密码
    user.password_hash = password; // 会在模型钩子中自动加密
    await user.save();

    // 记录活动
    await logUserActivity(req, {
      userId: user.id,
      action: "set_password",
      description: "用户设置了初始密码",
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });

    logger.info("用户设置初始密码成功:", {
      userId: user.id,
      username: user.username,
    });

    // Ensure numeric fields are returned as numbers
    const userData = user.toJSON();
    userData.balance = parseFloat(userData.balance) || 0;
    userData.total_spent = parseFloat(userData.total_spent) || 0;
    userData.total_recharged = parseFloat(userData.total_recharged) || 0;

    res.json({
      success: true,
      message: "密码设置成功",
      data: {
        user: userData,
      },
    });
  } catch (error) {
    logger.error("设置初始密码失败:", error);
    res.status(500).json({
      success: false,
      error: "设置失败，请稍后重试",
    });
  }
});

/**
 * 统一认证接口（支持所有登录和注册方式）
 * POST /api/auth/authenticate
 */
router.post("/authenticate", async (req, res) => {
  try {
    const { identifier, password, verification_code } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: "请输入用户名、邮箱或手机号",
      });
    }

    // 自动检测输入类型
    let inputType;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      inputType = "email";
    } else if (/^(\+86)?1[3-9]\d{9}$/.test(identifier)) {
      inputType = "phone";
    } else {
      inputType = "username";
    }

    // 情况1: 密码登录（支持用户名、邮箱、手机号）
    if (password) {
      const user = await User.findOne({
        where: {
          [Op.or]: [{ username: identifier }, { email: identifier }, { phone: identifier }],
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

      logger.info("用户密码登录成功:", {
        userId: user.id,
        username: user.username,
        inputType,
        ip: req.ip,
      });

      // Ensure numeric fields are returned as numbers
      const userData = user.toJSON();
      userData.balance = parseFloat(userData.balance) || 0;
      userData.total_spent = parseFloat(userData.total_spent) || 0;
      userData.total_recharged = parseFloat(userData.total_recharged) || 0;

      return res.json({
        success: true,
        message: "登录成功",
        data: {
          user: userData,
          ...tokens,
        },
      });
    }

    // 情况2: 验证码登录/注册（仅支持邮箱和手机号）
    if (verification_code) {
      if (inputType === "username") {
        return res.status(400).json({
          success: false,
          error: "验证码登录仅支持邮箱或手机号",
        });
      }

      // 查找现有用户
      let user = await User.findOne({
        where: inputType === "email" ? { email: identifier } : { phone: identifier },
      });

      // 如果用户不存在，自动创建账户
      if (!user) {
        const userData = {
          username:
            inputType === "email"
              ? identifier.split("@")[0]
              : identifier.replace(/^\+86/, "").replace(/^86/, ""),
          status: "active",
          balance: 0.0,
          total_spent: 0.0,
          total_recharged: 0.0,
        };

        if (inputType === "email") {
          userData.email = identifier;
        } else if (inputType === "phone") {
          userData.phone = identifier;
        }

        // 确保用户名唯一
        let finalUsername = userData.username;
        let existingUser = await User.findOne({ where: { username: finalUsername } });
        let counter = 1;

        while (existingUser) {
          finalUsername = `${userData.username}_${counter}`;
          existingUser = await User.findOne({ where: { username: finalUsername } });
          counter++;
        }

        userData.username = finalUsername;
        user = await User.create(userData);

        logger.info("自动创建用户账户:", {
          userId: user.id,
          username: user.username,
          inputType,
          ip: req.ip,
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

      logger.info("用户验证码登录成功:", {
        userId: user.id,
        username: user.username,
        inputType,
        ip: req.ip,
      });

      // Ensure numeric fields are returned as numbers
      const userData = user.toJSON();
      userData.balance = parseFloat(userData.balance) || 0;
      userData.total_spent = parseFloat(userData.total_spent) || 0;
      userData.total_recharged = parseFloat(userData.total_recharged) || 0;

      return res.json({
        success: true,
        message: "登录成功",
        data: {
          user: userData,
          ...tokens,
        },
      });
    }

    // 情况3: 仅输入标识符，返回用户信息（用于前端判断）
    if (inputType === "username") {
      return res.json({
        success: true,
        message: "请输入密码",
        data: {
          requires_password: true,
          input_type: inputType,
        },
      });
    } else {
      return res.json({
        success: true,
        message: "请选择登录方式",
        data: {
          supports_password: true,
          supports_verification: true,
          input_type: inputType,
        },
      });
    }
  } catch (error) {
    logger.error("统一认证失败:", error);
    res.status(500).json({
      success: false,
      error: "认证失败，请稍后重试",
    });
  }
});

module.exports = router;
