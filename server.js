const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const db = require("./config/database");
const logger = require("./utils/logger");
const seedSystemConfig = require("./scripts/seedSystemConfig");
const { errorHandler, notFoundHandler, asyncHandler } = require("./middleware/errorHandler");

// 路由导入
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const serviceRoutes = require("./routes/services");
const activationRoutes = require("./routes/activations");
const rentalRoutes = require("./routes/rentals");
const paymentRoutes = require("./routes/payment");
const webhookRoutes = require("./routes/webhook");
const healthRoutes = require("./routes/health");
const adminRoutes = require("./routes/admin");

const app = express();
const server = createServer(app);

// Socket.IO 配置
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production" ? ["https://smsyz.online"] : ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// 将 io 实例附加到 app，供路由使用
app.set("io", io);

// 全局中间件
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production" ? ["https://smsyz.online"] : ["http://localhost:3000"],
    credentials: true,
  })
);

// app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Socket.IO 中间件
app.use((req, res, next) => {
  req.io = io;
  next();
});

// 路由配置
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/activations", activationRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/admin", adminRoutes);

// Note: 健康检查端点已移至 /routes/health.js

// 静态文件服务 (生产环境)
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
  });
}

// 404 处理 - 必须在错误处理中间件之前
app.use("*", notFoundHandler);

// 全局错误处理中间件 - 必须在所有路由之后
app.use(errorHandler);

// Socket.IO 连接处理
io.on("connection", (socket) => {
  logger.info(`用户连接: ${socket.id}`);

  socket.on("join_user_room", (userId) => {
    socket.join(`user_${userId}`);
    logger.info(`用户 ${userId} 加入房间`);
  });

  socket.on("disconnect", () => {
    logger.info(`用户断开连接: ${socket.id}`);
  });
});

// 后台任务：自动检查激活状态
const { Activation, User, Transaction } = require("./models");
const SMSActivateService = require("./services/SMSActivateService");

let backgroundJobInterval = null;

async function checkPendingActivations() {
  try {
    logger.info("后台任务开始执行...");

    // 只查找等待短信的激活记录（状态 0=等待短信, 1=等待重试）
    const pendingActivations = await Activation.findAll({
      where: {
        status: ["0", "1"], // 只检查活跃状态的激活
        // 排除已收到短信、已取消、已完成的激活
        // 状态 3=已收到短信, 6=已取消, 8=激活完成
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username"],
        },
      ],
    });

    if (pendingActivations.length === 0) {
      logger.info("没有待处理的激活记录");
      return; // 没有待处理的激活，直接返回
    }

    logger.info(`后台任务：检查 ${pendingActivations.length} 个活跃激活的状态`);

    // 记录每个激活的详细信息
    for (const activation of pendingActivations) {
      logger.debug(
        `激活 ${activation.id}: 状态=${activation.status}, 过期时间=${activation.expires_at}`
      );
    }

    const smsService = new SMSActivateService();
    let updatedCount = 0;

    for (const activation of pendingActivations) {
      try {
        // 检查是否过期
        const expiresAt = new Date(activation.expires_at);
        const now = new Date();

        if (expiresAt <= now) {
          logger.info(
            `激活 ${
              activation.id
            } 已过期，自动取消 (过期时间: ${expiresAt.toISOString()}, 当前时间: ${now.toISOString()})`
          );

          // 计算退款金额
          let refundAmount = 0;
          if (activation.status === "0") {
            refundAmount = parseFloat(activation.cost);
          } else if (activation.status === "1") {
            refundAmount = parseFloat(activation.cost) * 0.5;
          }

          if (refundAmount > 0) {
            // 更新用户余额
            const user = await User.findByPk(activation.user_id);
            const balanceBefore = parseFloat(user.balance);
            const balanceAfter = balanceBefore + refundAmount;

            await user.update({ balance: balanceAfter });

            // 记录退款交易
            await Transaction.create({
              user_id: activation.user_id,
              type: "refund",
              amount: refundAmount,
              balance_before: balanceBefore,
              balance_after: balanceAfter,
              reference_id: activation.id.toString(),
              description: "激活过期自动退款",
            });

            // 通知用户余额更新
            io.to(`user_${activation.user_id}`).emit("balance_updated", {
              new_balance: balanceAfter,
              change_amount: refundAmount,
              transaction_type: "refund_expired",
              reference_id: activation.id,
              description: "激活过期自动退款",
            });
          }

          // 更新激活状态为已过期
          logger.debug(`更新激活 ${activation.id} 状态为已过期`);
          await activation.update({
            status: "6", // 已过期
            last_check_at: new Date(),
          });

          // 验证更新是否成功
          await activation.reload();
          logger.info(`激活 ${activation.id} 状态已更新为: ${activation.status}`);

          // 通知用户激活过期
          io.to(`user_${activation.user_id}`).emit("activation_updated", {
            id: activation.id,
            status: "6",
            status_text: "已过期",
            sms_code: null,
          });

          updatedCount++;
          continue;
        }

        // 调用 SMS Activate API 检查状态
        logger.debug(`检查激活 ${activation.id} 状态 (当前状态: ${activation.status})`);
        const statusResult = await smsService.checkActivationStatus(activation.activation_id);
        logger.debug(`激活 ${activation.id} API响应: ${JSON.stringify(statusResult)}`);

        // 如果状态有变化，更新数据库
        if (
          statusResult.status !== activation.status ||
          (statusResult.code && statusResult.code !== activation.sms_code)
        ) {
          logger.info(
            `激活 ${activation.id} 状态有变化: ${activation.status} -> ${statusResult.status}`
          );

          // 如果收到短信验证码，自动更新状态为"已收到短信"
          let newStatus = statusResult.status;
          if (statusResult.code && !activation.sms_code) {
            newStatus = "3"; // 已收到短信
            logger.info(`激活 ${activation.id} 收到短信验证码，状态更新为: 已收到短信`);
          }

          // 根据SMS-Activate API状态进行映射
          // STATUS_WAIT_CODE -> 0 (等待短信)
          // STATUS_WAIT_RETRY -> 1 (等待重试)
          // STATUS_OK -> 3 (已收到短信)
          // STATUS_CANCEL -> 6 (已取消)
          // STATUS_FINISH -> 8 (激活完成)
          if (statusResult.status === "STATUS_WAIT_CODE") {
            newStatus = "0";
          } else if (statusResult.status === "STATUS_WAIT_RETRY") {
            newStatus = "1";
          } else if (statusResult.status === "STATUS_OK") {
            newStatus = "3";
          } else if (statusResult.status === "STATUS_CANCEL") {
            newStatus = "6";
          } else if (statusResult.status === "STATUS_FINISH") {
            newStatus = "8";
          }

          await activation.update({
            status: newStatus,
            sms_code: statusResult.code || null,
            last_check_at: new Date(),
          });

          // 通知用户状态更新
          io.to(`user_${activation.user_id}`).emit("activation_updated", {
            id: activation.id,
            status: newStatus,
            sms_code: statusResult.code,
            status_text: getActivationStatusText(newStatus),
          });

          updatedCount++;

          // 如果收到短信验证码，记录日志
          if (statusResult.code) {
            logger.info(`激活 ${activation.id} 收到短信验证码: ${statusResult.code}`);
          }
        } else {
          // 记录调试信息，但不作为错误
          logger.debug(`激活 ${activation.id} 状态无变化: ${statusResult.status}`);
        }

        // 添加延迟避免API限流
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        // 区分真正的错误和正常的等待状态
        if (error.message === "等待第一条短信" || error.message === "等待代码确认") {
          logger.debug(`激活 ${activation.id} 状态: ${error.message}`);
        } else {
          logger.error(`检查激活 ${activation.id} 状态失败:`, error);
        }
        // 继续检查下一个激活
      }
    }

    if (updatedCount > 0) {
      logger.info(`后台任务完成：更新了 ${updatedCount} 个激活`);
    }
  } catch (error) {
    logger.error("后台任务检查激活状态失败:", error);
  }
}

// 获取激活状态文本
function getActivationStatusText(status) {
  const statusMap = {
    0: "等待短信",
    1: "等待重试",
    3: "已收到短信",
    6: "已取消",
    8: "激活完成",
  };
  return statusMap[status] || "未知状态";
}

// 启动后台任务
function startBackgroundJobs() {
  // 每10秒检查一次激活状态
  backgroundJobInterval = setInterval(checkPendingActivations, 10000);
  logger.info("后台任务已启动：每10秒检查激活状态");
}

// 停止后台任务
function stopBackgroundJobs() {
  if (backgroundJobInterval) {
    clearInterval(backgroundJobInterval);
    backgroundJobInterval = null;
    logger.info("后台任务已停止");
  }
}

// 数据库连接和服务器启动
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // 测试数据库连接
    await db.authenticate();
    logger.info("数据库连接成功");

    // 同步数据库模型
    if (process.env.NODE_ENV === "development") {
      await db.sync({ force: false });
      logger.info("数据库模型同步完成");

      // 初始化系统配置
      await seedSystemConfig();
    }

    // 启动后台任务
    startBackgroundJobs();

    // 启动服务器
    server.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV}`);
      logger.info("实时状态检查已启用");
    });
  } catch (error) {
    logger.error("服务器启动失败:", error);
    process.exit(1);
  }
}

// 优雅关闭
process.on("SIGTERM", () => {
  logger.info("收到 SIGTERM 信号，开始优雅关闭");
  stopBackgroundJobs();
  server.close(() => {
    logger.info("HTTP 服务器已关闭");
    db.close();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("收到 SIGINT 信号，开始优雅关闭");
  stopBackgroundJobs();
  server.close(() => {
    logger.info("HTTP 服务器已关闭");
    db.close();
    process.exit(0);
  });
});

startServer();

module.exports = { app, io };
