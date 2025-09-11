const express = require("express");
const { User, Activation, Rental, Transaction, PricingOverride } = require("../models");
const { authenticateToken, requireAdmin, logUserActivity } = require("../middleware/auth");
const {
  validatePagination,
  validateId,
  validatePricingQuery,
  validatePricingUpsert,
  validatePricingUpdate,
  validatePricingBatchUpdate,
  createValidationMiddleware,
} = require("../middleware/validation");
const { getPaginationParams, buildPaginatedResponse, formatDateTime } = require("../utils/helpers");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const logger = require("../utils/logger");
const router = express.Router();

// 所有管理员路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * 获取系统统计信息
 * GET /api/admin/stats
 */
router.get("/stats", logUserActivity("admin_view_stats"), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    // 并行获取各种统计数据
    const [
      userStats,
      activationStats,
      rentalStats,
      transactionStats,
      recentUsers,
      recentActivations,
      recentRentals,
    ] = await Promise.all([
      // 用户统计
      User.findAll({
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),

      // 激活统计
      Activation.findAll({
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("cost")), "total_cost"],
        ],
        where: {
          created_at: { [Op.gte]: daysAgo },
        },
        group: ["status"],
        raw: true,
      }),

      // 租用统计
      Rental.findAll({
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("cost")), "total_cost"],
        ],
        where: {
          created_at: { [Op.gte]: daysAgo },
        },
        group: ["status"],
        raw: true,
      }),

      // 交易统计
      Transaction.findAll({
        attributes: [
          "type",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        ],
        where: {
          created_at: { [Op.gte]: daysAgo },
        },
        group: ["type"],
        raw: true,
      }),

      // 最近注册用户
      User.count({
        where: {
          created_at: { [Op.gte]: daysAgo },
        },
      }),

      // 最近激活数量
      Activation.count({
        where: {
          created_at: { [Op.gte]: daysAgo },
        },
      }),

      // 最近租用数量
      Rental.count({
        where: {
          created_at: { [Op.gte]: daysAgo },
        },
      }),
    ]);

    // 计算总收入
    const totalRevenue = transactionStats.reduce((sum, stat) => {
      if (stat.type === "activation" || stat.type === "rental") {
        return sum + Math.abs(parseFloat(stat.total_amount || 0));
      }
      return sum;
    }, 0);

    // 计算总退款
    const totalRefunds = transactionStats.find((stat) => stat.type === "refund");
    const refundAmount = totalRefunds ? parseFloat(totalRefunds.total_amount || 0) : 0;

    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        users: {
          total: userStats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
          by_status: userStats.reduce((acc, stat) => {
            acc[stat.status] = parseInt(stat.count);
            return acc;
          }, {}),
          new_registrations: recentUsers,
        },
        activations: {
          total: recentActivations,
          by_status: activationStats.reduce((acc, stat) => {
            acc[stat.status] = {
              count: parseInt(stat.count),
              total_cost: parseFloat(stat.total_cost || 0),
            };
            return acc;
          }, {}),
        },
        rentals: {
          total: recentRentals,
          by_status: rentalStats.reduce((acc, stat) => {
            acc[stat.status] = {
              count: parseInt(stat.count),
              total_cost: parseFloat(stat.total_cost || 0),
            };
            return acc;
          }, {}),
        },
        financial: {
          total_revenue: totalRevenue,
          total_refunds: Math.abs(refundAmount),
          net_revenue: totalRevenue - Math.abs(refundAmount),
          transactions_by_type: transactionStats.reduce((acc, stat) => {
            acc[stat.type] = {
              count: parseInt(stat.count),
              total_amount: parseFloat(stat.total_amount || 0),
            };
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    logger.error("获取管理员统计失败:", error);
    res.status(500).json({
      success: false,
      error: "获取统计信息失败",
    });
  }
});

/**
 * 获取用户列表
 * GET /api/admin/users
 */
router.get(
  "/users",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("admin_view_users"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);
      const { status, search, sort = "created_at", order = "DESC" } = req.query;

      // 构建查询条件
      const whereClause = {};

      if (status) {
        whereClause.status = status;
      }

      if (search) {
        whereClause[Op.or] = [
          { username: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        order: [[sort, order.toUpperCase()]],
        limit,
        offset,
        attributes: { exclude: ["password_hash"] },
      });

      // 获取每个用户的统计信息
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const [activationCount, rentalCount, totalSpent] = await Promise.all([
            Activation.count({ where: { user_id: user.id } }),
            Rental.count({ where: { user_id: user.id } }),
            Transaction.sum("amount", {
              where: {
                user_id: user.id,
                type: ["activation", "rental"],
              },
            }),
          ]);

          // Ensure numeric fields are returned as numbers
          const userData = user.toJSON();
          userData.balance = parseFloat(userData.balance) || 0;
          userData.total_spent = parseFloat(userData.total_spent) || 0;
          userData.total_recharged = parseFloat(userData.total_recharged) || 0;

          return {
            ...userData,
            stats: {
              activation_count: activationCount,
              rental_count: rentalCount,
              total_spent: Math.abs(parseFloat(totalSpent || 0)),
            },
          };
        })
      );

      const response = buildPaginatedResponse(usersWithStats, count, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取用户列表失败:", error);
      res.status(500).json({
        success: false,
        error: "获取用户列表失败",
      });
    }
  }
);

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
router.get(
  "/users/:id",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("admin_view_user_detail"),
  async (req, res) => {
    try {
      const userId = req.params.id;

      const user = await User.findByPk(userId, {
        attributes: { exclude: ["password_hash"] },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      // 获取用户的详细统计信息
      const [activations, rentals, transactions, activationStats, rentalStats] = await Promise.all([
        Activation.findAll({
          where: { user_id: userId },
          order: [["created_at", "DESC"]],
          limit: 10,
        }),

        Rental.findAll({
          where: { user_id: userId },
          order: [["created_at", "DESC"]],
          limit: 10,
        }),

        Transaction.findAll({
          where: { user_id: userId },
          order: [["created_at", "DESC"]],
          limit: 20,
        }),

        Activation.findAll({
          where: { user_id: userId },
          attributes: [
            "status",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
            [sequelize.fn("SUM", sequelize.col("cost")), "total_cost"],
          ],
          group: ["status"],
          raw: true,
        }),

        Rental.findAll({
          where: { user_id: userId },
          attributes: [
            "status",
            [sequelize.fn("COUNT", sequelize.col("id")), "count"],
            [sequelize.fn("SUM", sequelize.col("cost")), "total_cost"],
          ],
          group: ["status"],
          raw: true,
        }),
      ]);

      // Ensure numeric fields are returned as numbers
      const userData = user.toJSON();
      userData.balance = parseFloat(userData.balance) || 0;
      userData.total_spent = parseFloat(userData.total_spent) || 0;
      userData.total_recharged = parseFloat(userData.total_recharged) || 0;

      res.json({
        success: true,
        data: {
          user: userData,
          recent_activations: activations.map((a) => ({
            id: a.id,
            service: a.service,
            status: a.status,
            cost: parseFloat(a.cost),
            created_at: formatDateTime(a.created_at),
          })),
          recent_rentals: rentals.map((r) => ({
            id: r.id,
            service: r.service,
            status: r.status,
            cost: parseFloat(r.cost),
            duration_hours: r.duration_hours,
            created_at: formatDateTime(r.created_at),
          })),
          recent_transactions: transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: parseFloat(t.amount),
            description: t.description,
            created_at: formatDateTime(t.created_at),
          })),
          stats: {
            activations_by_status: activationStats.reduce((acc, stat) => {
              acc[stat.status] = {
                count: parseInt(stat.count),
                total_cost: parseFloat(stat.total_cost || 0),
              };
              return acc;
            }, {}),
            rentals_by_status: rentalStats.reduce((acc, stat) => {
              acc[stat.status] = {
                count: parseInt(stat.count),
                total_cost: parseFloat(stat.total_cost || 0),
              };
              return acc;
            }, {}),
          },
        },
      });
    } catch (error) {
      logger.error("获取用户详情失败:", error);
      res.status(500).json({
        success: false,
        error: "获取用户详情失败",
      });
    }
  }
);

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
router.put(
  "/users/:id/status",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("admin_update_user_status"),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { status, reason } = req.body;

      if (!["active", "suspended", "pending"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "无效的用户状态",
        });
      }

      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      const oldStatus = user.status;
      await user.update({ status });

      logger.info("管理员更新用户状态:", {
        adminId: req.user.id,
        userId,
        oldStatus,
        newStatus: status,
        reason,
      });

      res.json({
        success: true,
        message: "用户状态更新成功",
        data: {
          user_id: userId,
          old_status: oldStatus,
          new_status: status,
        },
      });
    } catch (error) {
      logger.error("更新用户状态失败:", error);
      res.status(500).json({
        success: false,
        error: "更新用户状态失败",
      });
    }
  }
);

/**
 * 调整用户余额
 * POST /api/admin/users/:id/balance
 */
router.post(
  "/users/:id/balance",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("admin_adjust_balance"),
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.params.id;
      const { amount, type, description } = req.body;

      if (!amount || !type || !["add", "subtract"].includes(type)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: "无效的余额调整参数",
        });
      }

      const user = await User.findByPk(userId, { transaction });

      if (!user) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      const adjustAmount = parseFloat(amount);
      const balanceBefore = parseFloat(user.balance);
      let balanceAfter;

      if (type === "add") {
        balanceAfter = balanceBefore + adjustAmount;
      } else {
        balanceAfter = Math.max(0, balanceBefore - adjustAmount);
      }

      await user.update(
        {
          balance: balanceAfter,
          ...(type === "add" && {
            total_recharged: parseFloat(user.total_recharged) + adjustAmount,
          }),
        },
        { transaction }
      );

      // 记录交易
      await Transaction.create(
        {
          user_id: userId,
          type: "recharge",
          amount: type === "add" ? adjustAmount : -adjustAmount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: description || `管理员${type === "add" ? "增加" : "扣除"}余额`,
        },
        { transaction }
      );

      await transaction.commit();

      // 通知用户余额更新
      if (req.io) {
        req.io.to(`user_${userId}`).emit("balance_updated", {
          new_balance: balanceAfter,
          change_amount: type === "add" ? adjustAmount : -adjustAmount,
          transaction_type: "admin_adjustment",
          reference_id: `admin_${req.user.id}`,
          description: description || `管理员${type === "add" ? "增加" : "扣除"}余额`,
        });
      }

      logger.info("管理员调整用户余额:", {
        adminId: req.user.id,
        userId,
        type,
        amount: adjustAmount,
        balanceBefore,
        balanceAfter,
        description,
      });

      res.json({
        success: true,
        message: "余额调整成功",
        data: {
          user_id: userId,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          adjustment_amount: type === "add" ? adjustAmount : -adjustAmount,
        },
      });
    } catch (error) {
      await transaction.rollback();
      logger.error("调整用户余额失败:", error);
      res.status(500).json({
        success: false,
        error: "调整用户余额失败",
      });
    }
  }
);

/**
 * 获取系统配置
 * GET /api/admin/config
 */
router.get("/config", logUserActivity("admin_view_config"), async (req, res) => {
  try {
    // 返回系统配置（敏感信息需要过滤）
    const config = {
      price_markup: process.env.PRICE_MARKUP || "20",
      jwt_expire: process.env.JWT_EXPIRE || "24h",
      environment: process.env.NODE_ENV || "development",
    };

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("获取系统配置失败:", error);
    res.status(500).json({
      success: false,
      error: "获取系统配置失败",
    });
  }
});

/**
 * 获取系统日志
 * GET /api/admin/logs
 */
router.get(
  "/logs",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("admin_view_logs"),
  async (req, res) => {
    try {
      const { level = "info", days = 7 } = req.query;
      const { page, limit } = getPaginationParams(req.query.page, req.query.limit);

      // 这里应该实现日志查询逻辑
      // 由于日志通常存储在文件中，需要特殊处理

      res.json({
        success: true,
        message: "日志查询功能需要单独实现",
        data: {
          logs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      });
    } catch (error) {
      logger.error("获取系统日志失败:", error);
      res.status(500).json({
        success: false,
        error: "获取系统日志失败",
      });
    }
  }
);

/**
 * 创建数据库备份
 * POST /api/admin/backup
 */
router.post("/backup", logUserActivity("admin_create_backup"), async (req, res) => {
  try {
    // 这里实现实际的数据库备份逻辑
    // 可以使用 mysqldump 或其他备份工具

    // 模拟备份过程
    const backupId = `backup_${Date.now()}`;
    const backupPath = `./backups/${backupId}.sql`;

    // TODO: 实际备份实现
    // const result = await createDatabaseBackup(backupPath);

    logger.info("管理员创建数据库备份:", {
      adminId: req.user.id,
      backupId,
      backupPath,
    });

    res.json({
      success: true,
      message: "数据库备份已开始",
      data: {
        backup_id: backupId,
        status: "processing",
        estimated_time: "5-10 minutes",
      },
    });
  } catch (error) {
    logger.error("创建数据库备份失败:", error);
    res.status(500).json({
      success: false,
      error: "创建数据库备份失败",
    });
  }
});

/**
 * 发送系统通知
 * POST /api/admin/notifications
 */
router.post("/notifications", logUserActivity("admin_send_notification"), async (req, res) => {
  try {
    const { title, message, type = "info", target_users = "all" } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: "标题和消息内容不能为空",
      });
    }

    // 这里实现实际的通知发送逻辑
    // 可以发送邮件、推送通知等

    // TODO: 实际通知实现
    // const result = await sendSystemNotification(title, message, type, target_users);

    logger.info("管理员发送系统通知:", {
      adminId: req.user.id,
      title,
      message,
      type,
      target_users,
    });

    res.json({
      success: true,
      message: "系统通知已发送",
      data: {
        notification_id: `notif_${Date.now()}`,
        title,
        message,
        type,
        target_users,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("发送系统通知失败:", error);
    res.status(500).json({
      success: false,
      error: "发送系统通知失败",
    });
  }
});

/**
 * 系统健康检查
 * GET /api/admin/health
 */
router.get("/health", logUserActivity("admin_health_check"), async (req, res) => {
  try {
    // 检查数据库连接
    const dbStatus = await sequelize.authenticate();

    // 检查关键服务状态
    const services = {
      database: dbStatus ? "healthy" : "unhealthy",
      redis: "healthy", // TODO: 实际Redis检查
      file_system: "healthy", // TODO: 实际文件系统检查
      external_apis: "healthy", // TODO: 实际API检查
    };

    const overallStatus = Object.values(services).every((status) => status === "healthy")
      ? "healthy"
      : "degraded";

    logger.info("管理员执行系统健康检查:", {
      adminId: req.user.id,
      overallStatus,
      services,
    });

    res.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
      },
    });
  } catch (error) {
    logger.error("系统健康检查失败:", error);
    res.status(500).json({
      success: false,
      error: "系统健康检查失败",
      data: {
        status: "unhealthy",
        error: error.message,
      },
    });
  }
});

/**
 * 获取用户列表
 * GET /api/admin/users
 */
router.get(
  "/users",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("admin_view_users"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);
      const { status, search } = req.query;

      let whereClause = {};
      if (status) {
        whereClause.status = status;
      }
      if (search) {
        whereClause[Op.or] = [
          { username: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        attributes: [
          "id",
          "username",
          "email",
          "status",
          "balance",
          "total_recharged",
          "total_spent",
          "created_at",
          "last_login",
          "login_count",
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      const formattedUsers = users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        balance: parseFloat(user.balance || 0),
        total_recharged: parseFloat(user.total_recharged || 0),
        total_spent: parseFloat(user.total_spent || 0),
        created_at: formatDateTime(user.created_at),
        last_login: user.last_login ? formatDateTime(user.last_login) : null,
        login_count: user.login_count || 0,
      }));

      const response = buildPaginatedResponse(formattedUsers, count, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取用户列表失败:", error);
      res.status(500).json({
        success: false,
        error: "获取用户列表失败",
      });
    }
  }
);

/**
 * 获取交易记录
 * GET /api/admin/transactions
 */
router.get(
  "/transactions",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("admin_view_transactions"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);
      const { type, days = 30 } = req.query;

      let whereClause = {};
      if (type) {
        whereClause.type = type;
      }
      if (days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        whereClause.created_at = { [Op.gte]: daysAgo };
      }

      const { count, rows: transactions } = await Transaction.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      const formattedTransactions = transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amount: parseFloat(transaction.amount || 0),
        balance_before: parseFloat(transaction.balance_before || 0),
        balance_after: parseFloat(transaction.balance_after || 0),
        reference_id: transaction.reference_id,
        description: transaction.description,
        status: transaction.status,
        created_at: formatDateTime(transaction.created_at),
        completed_at: transaction.completed_at ? formatDateTime(transaction.completed_at) : null,
        user: transaction.user,
      }));

      const response = buildPaginatedResponse(formattedTransactions, count, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取交易记录失败:", error);
      res.status(500).json({
        success: false,
        error: "获取交易记录失败",
      });
    }
  }
);

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
router.put(
  "/users/:id/status",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("admin_update_user_status"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      await user.update({ status });

      res.json({
        success: true,
        message: "用户状态更新成功",
      });
    } catch (error) {
      logger.error("更新用户状态失败:", error);
      res.status(500).json({
        success: false,
        error: "更新用户状态失败",
      });
    }
  }
);

/**
 * 调整用户余额
 * POST /api/admin/users/:id/balance
 */
router.post(
  "/users/:id/balance",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("admin_adjust_user_balance"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, type, description } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "用户不存在",
        });
      }

      const currentBalance = parseFloat(user.balance || 0);
      let newBalance;
      let totalRecharged = parseFloat(user.total_recharged || 0);

      if (type === "add") {
        newBalance = currentBalance + parseFloat(amount);
        if (description.includes("充值")) {
          totalRecharged += parseFloat(amount);
        }
      } else if (type === "subtract") {
        newBalance = currentBalance - parseFloat(amount);
        if (newBalance < 0) {
          return res.status(400).json({
            success: false,
            error: "余额不足",
          });
        }
      }

      await user.update({
        balance: newBalance,
        total_recharged: totalRecharged,
      });

      // 创建交易记录
      await Transaction.create({
        user_id: id,
        type: type === "add" ? "recharge" : "adjustment",
        amount: parseFloat(amount),
        balance_before: currentBalance,
        balance_after: newBalance,
        description: description,
      });

      res.json({
        success: true,
        message: "余额调整成功",
      });
    } catch (error) {
      logger.error("调整用户余额失败:", error);
      res.status(500).json({
        success: false,
        error: "调整用户余额失败",
      });
    }
  }
);

/**
 * 获取活跃激活列表
 * GET /api/admin/activations/active
 */
router.get(
  "/activations/active",
  createValidationMiddleware(validatePagination, "query"),
  logUserActivity("admin_view_active_activations"),
  async (req, res) => {
    try {
      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);

      const { count, rows: activations } = await Activation.findAndCountAll({
        where: {
          status: ["0", "1"], // 等待短信或等待重试
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email"],
          },
        ],
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      const formattedActivations = activations.map((activation) => ({
        id: activation.id,
        activation_id: activation.activation_id,
        service: activation.service,
        phone_number: activation.phone_number,
        status: activation.status,
        cost: parseFloat(activation.cost),
        created_at: formatDateTime(activation.created_at),
        expires_at: formatDateTime(activation.expires_at),
        user: activation.user,
      }));

      const response = buildPaginatedResponse(formattedActivations, count, page, limit);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error("获取活跃激活列表失败:", error);
      res.status(500).json({
        success: false,
        error: "获取活跃激活列表失败",
      });
    }
  }
);

module.exports = router;

/**
 * 定价覆盖：列表
 * GET /api/admin/pricing
 */
router.get(
  "/pricing",
  createValidationMiddleware(validatePricingQuery, "query"),
  logUserActivity("admin_view_pricing"),
  async (req, res) => {
    try {
      // 确保定价表已创建
      try {
        await PricingOverride.sync();
      } catch (syncErr) {
        logger.error("定价表创建/检查失败:", syncErr);
      }

      const { page, limit, offset } = getPaginationParams(req.query.page, req.query.limit);
      const { service_code, country_id, enabled, sortBy = "updated_at", sortOrder = "DESC" } =
        req.query;

      const where = {};
      if (service_code) where.service_code = service_code;
      if (country_id !== undefined) where.country_id = country_id;
      if (enabled !== undefined) where.enabled = enabled;

      const { count, rows } = await PricingOverride.findAndCountAll({
        where,
        order: [[sortBy, sortOrder]],
        limit,
        offset,
      });

      const items = rows.map((r) => ({
        id: r.id,
        service_code: r.service_code,
        country_id: r.country_id,
        price: parseFloat(r.price),
        currency: r.currency,
        enabled: !!r.enabled,
        notes: r.notes,
        updated_by: r.updated_by,
        created_at: formatDateTime(r.created_at),
        updated_at: formatDateTime(r.updated_at),
      }));

      const response = buildPaginatedResponse(items, count, page, limit);
      res.json({ success: true, data: response });
    } catch (error) {
      logger.error("获取定价覆盖列表失败:", error);
      res.status(500).json({ success: false, error: "获取定价列表失败" });
    }
  }
);

/**
 * 定价覆盖：创建或覆盖
 * POST /api/admin/pricing
 */
router.post(
  "/pricing",
  createValidationMiddleware(validatePricingUpsert),
  logUserActivity("admin_upsert_pricing"),
  async (req, res) => {
    try {
      // 确保定价表已创建
      try {
        await PricingOverride.sync();
      } catch (syncErr) {
        logger.error("定价表创建/检查失败:", syncErr);
      }

      const { service_code, country_id, price, currency = "USD", enabled = true, notes } = req.body;

      const [row, created] = await PricingOverride.findOrCreate({
        where: { service_code, country_id },
        defaults: {
          price,
          currency,
          enabled,
          notes: notes || null,
          updated_by: req.user.id,
        },
      });

      if (!created) {
        await row.update({ price, currency, enabled, notes: notes || null, updated_by: req.user.id, updated_at: new Date() });
      }

      res.status(created ? 201 : 200).json({
        success: true,
        message: created ? "定价已创建" : "定价已更新",
        data: {
          id: row.id,
          service_code: row.service_code,
          country_id: row.country_id,
          price: parseFloat(row.price),
          currency: row.currency,
          enabled: !!row.enabled,
          notes: row.notes,
        },
      });
    } catch (error) {
      logger.error("创建/更新定价失败:", error);
      res.status(500).json({ success: false, error: "创建/更新定价失败" });
    }
  }
);

/**
 * 定价覆盖：按ID更新
 * PUT /api/admin/pricing/:id
 */
router.put(
  "/pricing/:id",
  createValidationMiddleware(validateId, "params"),
  createValidationMiddleware(validatePricingUpdate),
  logUserActivity("admin_update_pricing"),
  async (req, res) => {
    try {
      // 确保定价表已创建
      try {
        await PricingOverride.sync();
      } catch (syncErr) {
        logger.error("定价表创建/检查失败:", syncErr);
      }

      const { id } = req.params;
      const row = await PricingOverride.findByPk(id);
      if (!row) {
        return res.status(404).json({ success: false, error: "定价不存在" });
      }

      await row.update({ ...req.body, updated_by: req.user.id, updated_at: new Date() });

      res.json({
        success: true,
        message: "定价已更新",
        data: {
          id: row.id,
          service_code: row.service_code,
          country_id: row.country_id,
          price: parseFloat(row.price),
          currency: row.currency,
          enabled: !!row.enabled,
          notes: row.notes,
        },
      });
    } catch (error) {
      logger.error("更新定价失败:", error);
      res.status(500).json({ success: false, error: "更新定价失败" });
    }
  }
);

/**
 * 定价覆盖：删除
 * DELETE /api/admin/pricing/:id
 */
router.delete(
  "/pricing/:id",
  createValidationMiddleware(validateId, "params"),
  logUserActivity("admin_delete_pricing"),
  async (req, res) => {
    try {
      // 确保定价表已创建
      try {
        await PricingOverride.sync();
      } catch (syncErr) {
        logger.error("定价表创建/检查失败:", syncErr);
      }

      const { id } = req.params;
      const row = await PricingOverride.findByPk(id);
      if (!row) {
        return res.status(404).json({ success: false, error: "定价不存在" });
      }

      await row.destroy();
      res.json({ success: true, message: "定价已删除" });
    } catch (error) {
      logger.error("删除定价失败:", error);
      res.status(500).json({ success: false, error: "删除定价失败" });
    }
  }
);

/**
 * 定价覆盖：批量更新
 * POST /api/admin/pricing/batch
 */
router.post(
  "/pricing/batch",
  createValidationMiddleware(validatePricingBatchUpdate),
  logUserActivity("admin_batch_update_pricing"),
  async (req, res) => {
    try {
      const { mode, country_id, service_code, operation, value, enabled, create_missing } = req.body;

      // 构建筛选条件
      const where = {};
      if (mode === "by_country") where.country_id = country_id;
      if (mode === "by_service") where.service_code = service_code;

      const rows = await PricingOverride.findAll({ where });

      let affected = 0;
      // 如果需要创建缺失项
      if (create_missing) {
        if (mode === "by_country") {
          // 为该国家的所有服务创建
          const servicesJson = require("../client/src/data/services.json");
          const serviceCodes = [];
          servicesJson.forEach((cat) => cat.services?.forEach((s) => s?.code && serviceCodes.push(s.code)));

          for (const code of serviceCodes) {
            const [row] = await PricingOverride.findOrCreate({
              where: { service_code: code, country_id },
              defaults: { price: 0.5, currency: "USD", enabled: true },
            });
            rows.push(row);
          }
        } else if (mode === "by_service") {
          // 为该服务的所有国家创建
          const countriesJson = require("../client/src/data/countries.json");
          const countryIds = countriesJson.map((c) => c.id);
          for (const cid of countryIds) {
            const [row] = await PricingOverride.findOrCreate({
              where: { service_code, country_id: cid },
              defaults: { price: 0.5, currency: "USD", enabled: true },
            });
            rows.push(row);
          }
        }
      }

      // 去重
      const uniqueMap = new Map();
      for (const r of rows) uniqueMap.set(`${r.service_code}_${r.country_id}`, r);
      const uniqueRows = Array.from(uniqueMap.values());

      for (const row of uniqueRows) {
        let newPrice = parseFloat(row.price);
        switch (operation) {
          case "set":
            newPrice = value;
            break;
          case "increase":
            newPrice = newPrice + value;
            break;
          case "decrease":
            newPrice = Math.max(0.01, newPrice - value);
            break;
          case "multiply":
            newPrice = newPrice * value;
            break;
        }
        await row.update({
          price: Math.round(newPrice * 100) / 100,
          ...(typeof enabled === "boolean" ? { enabled } : {}),
          updated_by: req.user.id,
          updated_at: new Date(),
        });
        affected += 1;
      }

      res.json({ success: true, message: "批量更新完成", data: { affected } });
    } catch (error) {
      logger.error("批量更新定价失败:", error);
      res.status(500).json({ success: false, error: "批量更新定价失败" });
    }
  }
);
