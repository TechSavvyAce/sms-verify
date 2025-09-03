const express = require("express");
const { Op, fn, col } = require("sequelize");
const { User, Transaction, Activation, Rental, ApiKey } = require("../models");
const { authenticateToken, logUserActivity } = require("../middleware/auth");
const {
  validateProfileUpdate,
  validatePagination,
  validateDateRange,
  createValidationMiddleware,
} = require("../middleware/validation");
const { getPaginationParams, buildPaginatedResponse, formatDateTime } = require("../utils/helpers");
const logger = require("../utils/logger");
const router = express.Router();

// 所有用户路由都需要认证
router.use(authenticateToken);

/**
 * 获取用户资料
 * GET /api/user/profile
 */
router.get("/profile", logUserActivity("view_profile"), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password_hash"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // Ensure numeric fields are returned as numbers
    const userData = user.toJSON();
    userData.balance = parseFloat(userData.balance) || 0;
    userData.total_spent = parseFloat(userData.total_spent) || 0;
    userData.total_recharged = parseFloat(userData.total_recharged) || 0;

    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    logger.error("获取用户资料失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户资料失败",
    });
  }
});

/**
 * 更新用户资料
 * PUT /api/user/profile
 */
router.put(
  "/profile",
  createValidationMiddleware(validateProfileUpdate),
  logUserActivity("update_profile"),
  async (req, res) => {
    try {
      const {
        username,
        email,
        phone,
        country,
        timezone,
        language,
        current_password,
        new_password,
      } = req.body;
      const user = await User.findByPk(req.user.id);

      // 如果要修改密码，验证当前密码
      if (new_password) {
        if (!current_password) {
          return res.status(400).json({
            success: false,
            error: "修改密码时必须提供当前密码",
          });
        }

        const isValidPassword = await user.validatePassword(current_password);
        if (!isValidPassword) {
          return res.status(400).json({
            success: false,
            error: "当前密码错误",
          });
        }

        user.password_hash = new_password;
      }

      // 检查用户名是否已被使用
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: "用户名已被使用",
          });
        }
        user.username = username;
      }

      // 检查邮箱是否已被使用
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: "邮箱已被使用",
          });
        }
        user.email = email;
      }

      // 更新其他字段
      if (phone !== undefined) user.phone = phone;
      if (country !== undefined) user.country = country;
      if (timezone !== undefined) user.timezone = timezone;
      if (language !== undefined) user.language = language;

      await user.save();

      logger.info("用户资料更新成功:", {
        userId: user.id,
        changes: { username, email, passwordChanged: !!new_password },
      });

      res.json({
        success: true,
        message: "资料更新成功",
        data: user.toJSON(),
      });
    } catch (error) {
      logger.error("更新用户资料失败:", error);
      res.status(500).json({
        success: false,
        error: "更新用户资料失败",
      });
    }
  }
);

/**
 * 获取用户余额
 * GET /api/user/balance
 */
router.get("/balance", logUserActivity("view_balance"), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["balance", "total_spent", "total_recharged"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    res.json({
      success: true,
      data: {
        balance: parseFloat(user.balance),
        total_spent: parseFloat(user.total_spent),
        total_recharged: parseFloat(user.total_recharged),
        currency: "CNY",
      },
    });
  } catch (error) {
    logger.error("获取用户余额失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户余额失败",
    });
  }
});

/**
 * 获取交易历史
 * GET /api/user/transactions
 */
router.get(
  "/transactions",
  createValidationMiddleware(validatePagination, "query"),
  createValidationMiddleware(validateDateRange, "query"),
  logUserActivity("view_transactions"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);
      const { start_date, end_date, type } = req.query;

      // 构建查询条件
      const whereClause = { user_id: req.user.id };

      if (start_date || end_date) {
        whereClause.created_at = {};
        if (start_date) whereClause.created_at[Op.gte] = new Date(start_date);
        if (end_date) whereClause.created_at[Op.lte] = new Date(end_date);
      }

      if (type) {
        whereClause.type = type;
      }

      const { count, rows: transactions } = await Transaction.findAndCountAll({
        where: whereClause,
        order: [["created_at", "DESC"]],
        limit,
        offset,
        attributes: [
          "id",
          "type",
          "amount",
          "balance_before",
          "balance_after",
          "reference_id",
          "description",
          "status",
          "created_at",
          "completed_at",
        ],
      });

      // 格式化交易数据
      const formattedTransactions = transactions.map((transaction) => ({
        ...transaction.toJSON(),
        amount: parseFloat(transaction.amount),
        balance_before: parseFloat(transaction.balance_before),
        balance_after: parseFloat(transaction.balance_after),
        created_at: formatDateTime(transaction.created_at),
        type_display: getTransactionTypeDisplay(transaction.type),
      }));

      const response = buildPaginatedResponse(formattedTransactions, count, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取交易历史失败:", error);
      res.status(500).json({
        success: false,
        error: "获取交易历史失败",
      });
    }
  }
);

/**
 * 获取用户统计信息
 * GET /api/user/stats
 */
router.get("/stats", logUserActivity("view_stats"), async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取各种统计数据
    const [activationStats, rentalStats, transactionStats] = await Promise.all([
      // 激活统计
      Activation.findAll({
        where: { user_id: userId },
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("cost")), "total_cost"],
        ],
        group: ["status"],
        raw: true,
      }),

      // 租用统计
      Rental.findAll({
        where: { user_id: userId },
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("cost")), "total_cost"],
        ],
        group: ["status"],
        raw: true,
      }),

      // 交易统计
      Transaction.findAll({
        where: { user_id: userId },
        attributes: [
          "type",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("amount")), "total_amount"],
        ],
        group: ["type"],
        raw: true,
      }),
    ]);

    // 最近30天的活动
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await Transaction.findAll({
      where: {
        user_id: userId,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
      attributes: [
        [fn("DATE", col("created_at")), "date"],
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("amount")), "amount"],
      ],
      group: [fn("DATE", col("created_at"))],
      order: [[fn("DATE", col("created_at")), "ASC"]],
      raw: true,
    });

    res.json({
      success: true,
      data: {
        activations: activationStats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: parseInt(stat.count),
            total_cost: parseFloat(stat.total_cost || 0),
          };
          return acc;
        }, {}),
        rentals: rentalStats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: parseInt(stat.count),
            total_cost: parseFloat(stat.total_cost || 0),
          };
          return acc;
        }, {}),
        transactions: transactionStats.reduce((acc, stat) => {
          acc[stat.type] = {
            count: parseInt(stat.count),
            total_amount: parseFloat(stat.total_amount || 0),
          };
          return acc;
        }, {}),
        recent_activity: recentActivity.map((activity) => ({
          date: activity.date,
          count: parseInt(activity.count),
          amount: parseFloat(activity.amount || 0),
        })),
      },
    });
  } catch (error) {
    logger.error("获取用户统计失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户统计失败",
    });
  }
});

/**
 * 获取用户活动记录
 * GET /api/user/activities
 */
router.get(
  "/activities",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("view_activities"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);

      // 合并激活和租用记录作为活动记录
      const [activations, rentals] = await Promise.all([
        Activation.findAll({
          where: { user_id: req.user.id },
          order: [["created_at", "DESC"]],
          limit: limit * 2, // 获取更多数据用于合并排序
          attributes: ["id", "service", "phone_number", "status", "cost", "created_at"],
        }),

        Rental.findAll({
          where: { user_id: req.user.id },
          order: [["created_at", "DESC"]],
          limit: limit * 2,
          attributes: [
            "id",
            "service",
            "phone_number",
            "status",
            "cost",
            "duration_hours",
            "created_at",
          ],
        }),
      ]);

      // 合并和格式化活动记录
      const activities = [
        ...activations.map((activation) => ({
          id: activation.id,
          type: "activation",
          service: activation.service,
          phone_number: activation.phone_number,
          status: activation.status,
          cost: parseFloat(activation.cost),
          created_at: formatDateTime(activation.created_at),
          display_name: "短信激活",
        })),
        ...rentals.map((rental) => ({
          id: rental.id,
          type: "rental",
          service: rental.service,
          phone_number: rental.phone_number,
          status: rental.status,
          cost: parseFloat(rental.cost),
          duration_hours: rental.duration_hours,
          created_at: formatDateTime(rental.created_at),
          display_name: "号码租用",
        })),
      ];

      // 按时间排序并分页
      activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const total = activities.length;
      const paginatedActivities = activities.slice(offset, offset + limit);

      const response = buildPaginatedResponse(paginatedActivities, total, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取用户活动失败:", error);
      res.status(500).json({
        success: false,
        error: "获取用户活动失败",
      });
    }
  }
);

/**
 * 获取API密钥列表
 * GET /api/user/api-keys
 */
router.get("/api-keys", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const apiKeys = await ApiKey.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      attributes: {
        exclude: ["key_hash"],
      },
    });

    res.json({
      success: true,
      data: {
        keys: apiKeys,
      },
    });
  } catch (error) {
    logger.error("获取API密钥列表失败:", error);
    res.status(500).json({
      success: false,
      error: "获取API密钥列表失败",
    });
  }
});

/**
 * 创建API密钥
 * POST /api/user/api-keys
 */
router.post("/api-keys", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, permissions = ["read"], expires_in_days } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "API密钥名称不能为空",
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        error: "API密钥名称不能超过100个字符",
      });
    }

    // 检查用户API密钥数量限制
    const existingCount = await ApiKey.count({
      where: { user_id: userId, status: "active" },
    });

    if (existingCount >= 10) {
      return res.status(400).json({
        success: false,
        error: "API密钥数量不能超过10个",
      });
    }

    // 计算过期时间
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // 创建API密钥
    const { apiKey, plainKey } = await ApiKey.createKey(
      userId,
      name.trim(),
      permissions,
      expiresAt
    );

    logger.info("用户创建API密钥:", {
      userId,
      keyId: apiKey.id,
      name: name.trim(),
      permissions,
    });

    res.status(201).json({
      success: true,
      data: {
        apiKey: apiKey.toJSON(),
        key: plainKey, // 只在创建时返回一次
      },
    });
  } catch (error) {
    logger.error("创建API密钥失败:", error);
    res.status(500).json({
      success: false,
      error: "创建API密钥失败",
    });
  }
});

/**
 * 删除API密钥
 * DELETE /api/user/api-keys/:keyId
 */
router.delete("/api-keys/:keyId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;

    const apiKey = await ApiKey.findOne({
      where: {
        id: keyId,
        user_id: userId,
      },
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: "API密钥不存在",
      });
    }

    await apiKey.destroy();

    logger.info("用户删除API密钥:", {
      userId,
      keyId,
      name: apiKey.name,
    });

    res.json({
      success: true,
      message: "API密钥已删除",
    });
  } catch (error) {
    logger.error("删除API密钥失败:", error);
    res.status(500).json({
      success: false,
      error: "删除API密钥失败",
    });
  }
});

/**
 * 更新API密钥状态
 * PUT /api/user/api-keys/:keyId/status
 */
router.put("/api-keys/:keyId/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;
    const { status } = req.body;

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "无效的状态值",
      });
    }

    const apiKey = await ApiKey.findOne({
      where: {
        id: keyId,
        user_id: userId,
      },
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: "API密钥不存在",
      });
    }

    await apiKey.update({ status });

    logger.info("用户更新API密钥状态:", {
      userId,
      keyId,
      status,
    });

    res.json({
      success: true,
      data: {
        apiKey: apiKey.toJSON(),
      },
    });
  } catch (error) {
    logger.error("更新API密钥状态失败:", error);
    res.status(500).json({
      success: false,
      error: "更新API密钥状态失败",
    });
  }
});

/**
 * 修改密码
 * POST /api/user/change-password
 */
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: "当前密码和新密码不能为空",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "新密码长度至少为6个字符",
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

    // 验证当前密码
    const isCurrentPasswordValid = await user.validatePassword(current_password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: "当前密码错误",
      });
    }

    // 更新密码
    user.password_hash = new_password;
    await user.save();

    logger.info("用户修改密码:", { userId });

    res.json({
      success: true,
      message: "密码修改成功",
    });
  } catch (error) {
    logger.error("修改密码失败:", error);
    res.status(500).json({
      success: false,
      error: "修改密码失败",
    });
  }
});

/**
 * 更新通知设置
 * PUT /api/user/notifications
 */
router.put("/notifications", logUserActivity("update_notifications"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_notifications, sms_notifications, push_notifications } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 更新通知设置
    if (email_notifications !== undefined) user.email_notifications = email_notifications;
    if (sms_notifications !== undefined) user.sms_notifications = sms_notifications;
    if (push_notifications !== undefined) user.push_notifications = push_notifications;

    await user.save();

    logger.info("用户更新通知设置:", {
      userId,
      settings: {
        email_notifications,
        sms_notifications,
        push_notifications,
      },
    });

    res.json({
      success: true,
      message: "通知设置已更新",
      data: {
        email_notifications: user.email_notifications,
        sms_notifications: user.sms_notifications,
        push_notifications: user.push_notifications,
      },
    });
  } catch (error) {
    logger.error("更新通知设置失败:", error);
    res.status(500).json({
      success: false,
      error: "更新通知设置失败",
    });
  }
});

/**
 * 获取用户活动日志
 * GET /api/user/activity-logs
 */
router.get("/activity-logs", logUserActivity("view_activity_logs"), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // 这里应该从用户活动日志表获取数据
    // 目前返回模拟数据，实际项目中应该有专门的活动日志表
    const mockActivityLogs = [
      {
        id: 1,
        action: "login",
        description: "用户登录成功",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        created_at: new Date().toISOString(),
        status: "success",
      },
      {
        id: 2,
        action: "profile_update",
        description: "更新个人资料",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        status: "success",
      },
      {
        id: 3,
        action: "password_change",
        description: "修改密码",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        status: "success",
      },
    ];

    res.json({
      success: true,
      data: mockActivityLogs,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_count: mockActivityLogs.length,
        total_pages: Math.ceil(mockActivityLogs.length / limit),
      },
    });
  } catch (error) {
    logger.error("获取用户活动日志失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户活动日志失败",
    });
  }
});

/**
 * 获取用户安全设置
 * GET /api/user/security-settings
 */
router.get("/security-settings", logUserActivity("view_security_settings"), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "created_at", "updated_at"],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 这里应该从安全设置表获取数据
    // 目前返回模拟数据，实际项目中应该有专门的安全设置表
    const mockSecuritySettings = {
      password_changed_at: user.updated_at,
      last_password_reset: null,
      failed_login_attempts: 0,
      account_locked_until: null,
      trusted_devices: 1,
      api_keys_count: 0,
    };

    res.json({
      success: true,
      data: mockSecuritySettings,
    });
  } catch (error) {
    logger.error("获取用户安全设置失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户安全设置失败",
    });
  }
});

/**
 * 更新用户头像
 * PUT /api/user/avatar
 */
router.put("/avatar", logUserActivity("update_avatar"), async (req, res) => {
  try {
    // 这里应该处理头像上传
    // 实际项目中应该有文件上传中间件和头像处理逻辑

    logger.info("用户更新头像:", { userId: req.user.id });

    res.json({
      success: true,
      message: "头像更新成功",
      data: {
        avatar_url: "/uploads/avatars/default.jpg", // 这里应该是实际的头像URL
      },
    });
  } catch (error) {
    logger.error("更新用户头像失败:", error);
    res.status(500).json({
      success: false,
      error: "更新用户头像失败",
    });
  }
});

/**
 * 获取交易类型显示名称
 */
function getTransactionTypeDisplay(type) {
  const typeMap = {
    recharge: "充值",
    activation: "激活消费",
    rental: "租用消费",
    refund: "退款",
  };
  return typeMap[type] || type;
}

module.exports = router;
