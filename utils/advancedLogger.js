const winston = require("winston");
const path = require("path");
const fs = require("fs");

// 确保日志目录存在
const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * 自定义日志格式
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` | META: ${JSON.stringify(meta)}`;
    }

    if (stack) {
      log += `\nSTACK: ${stack}`;
    }

    return log;
  })
);

/**
 * 控制台格式（彩色）
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss.SSS",
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

/**
 * 创建高级日志记录器
 */
const createAdvancedLogger = () => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: customFormat,
    defaultMeta: {
      service: "sms-verify-platform",
      environment: process.env.NODE_ENV || "development",
      version: process.env.APP_VERSION || "1.0.0",
    },
    transports: [
      // 错误日志文件
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        level: "error",
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),

      // 组合日志文件
      new winston.transports.File({
        filename: path.join(logDir, "combined.log"),
        maxsize: 5242880, // 5MB
        maxFiles: 15,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),

      // API访问日志
      new winston.transports.File({
        filename: path.join(logDir, "api-access.log"),
        level: "info",
        maxsize: 5242880, // 5MB
        maxFiles: 10,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
          winston.format.printf(({ timestamp, message, ...meta }) => {
            if (meta.type === "api_access") {
              return JSON.stringify({
                timestamp,
                ...meta,
              });
            }
            return JSON.stringify({ timestamp, message, ...meta });
          })
        ),
      }),

      // 安全日志
      new winston.transports.File({
        filename: path.join(logDir, "security.log"),
        level: "warn",
        maxsize: 5242880, // 5MB
        maxFiles: 20,
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),

      // 性能日志
      new winston.transports.File({
        filename: path.join(logDir, "performance.log"),
        level: "info",
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
          winston.format
            .printf(({ timestamp, message, ...meta }) => {
              if (meta.type === "performance") {
                return JSON.stringify({
                  timestamp,
                  ...meta,
                });
              }
              return null;
            })
            .filter(Boolean)
        ),
      }),
    ],
  });

  // 控制台输出（仅在开发环境）
  if (process.env.NODE_ENV !== "production") {
    logger.add(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }

  return logger;
};

const logger = createAdvancedLogger();

/**
 * API访问日志记录器
 */
const logApiAccess = (req, res, responseTime) => {
  const logData = {
    type: "api_access",
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
    contentLength: res.get("Content-Length"),
    referrer: req.get("Referrer"),
  };

  // 根据状态码决定日志级别
  if (res.statusCode >= 500) {
    logger.error("API访问 - 服务器错误", logData);
  } else if (res.statusCode >= 400) {
    logger.warn("API访问 - 客户端错误", logData);
  } else {
    logger.info("API访问", logData);
  }
};

/**
 * 安全事件日志记录器
 */
const logSecurityEvent = (event, details = {}, level = "warn") => {
  const logData = {
    type: "security_event",
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };

  logger.log(level, `安全事件: ${event}`, logData);
};

/**
 * 性能监控日志记录器
 */
const logPerformance = (operation, duration, details = {}) => {
  const logData = {
    type: "performance",
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details,
  };

  // 根据执行时间决定日志级别
  if (duration > 5000) {
    logger.error(`性能警告: ${operation} 执行时间过长`, logData);
  } else if (duration > 2000) {
    logger.warn(`性能提醒: ${operation} 执行时间较长`, logData);
  } else {
    logger.info(`性能监控: ${operation}`, logData);
  }
};

/**
 * 用户活动日志记录器
 */
const logUserActivity = (userId, action, details = {}) => {
  const logData = {
    type: "user_activity",
    userId,
    action,
    timestamp: new Date().toISOString(),
    ...details,
  };

  logger.info(`用户活动: ${action}`, logData);
};

/**
 * 数据库操作日志记录器
 */
const logDatabaseOperation = (operation, query, duration, details = {}) => {
  const logData = {
    type: "database_operation",
    operation,
    query: query.substring(0, 200), // 限制查询长度
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (duration > 1000) {
    logger.warn(`数据库慢查询: ${operation}`, logData);
  } else {
    logger.debug(`数据库操作: ${operation}`, logData);
  }
};

/**
 * 外部API调用日志记录器
 */
const logExternalApiCall = (service, endpoint, method, duration, statusCode, details = {}) => {
  const logData = {
    type: "external_api_call",
    service,
    endpoint,
    method,
    duration: `${duration}ms`,
    statusCode,
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (statusCode >= 500 || duration > 10000) {
    logger.error(`外部API调用失败/超时: ${service}`, logData);
  } else if (statusCode >= 400) {
    logger.warn(`外部API调用错误: ${service}`, logData);
  } else {
    logger.info(`外部API调用: ${service}`, logData);
  }
};

/**
 * 错误上下文增强器
 */
const enhanceError = (error, context = {}) => {
  const enhancedError = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    context,
  };

  // 添加请求上下文（如果存在）
  if (context.req) {
    enhancedError.request = {
      method: context.req.method,
      url: context.req.originalUrl,
      ip: context.req.ip,
      userAgent: context.req.get("User-Agent"),
      userId: context.req.user?.id,
    };
  }

  // 添加数据库错误详情
  if (error.name?.includes("Sequelize")) {
    enhancedError.database = {
      sql: error.sql,
      parameters: error.parameters,
    };
  }

  // 添加HTTP错误详情
  if (error.response) {
    enhancedError.http = {
      status: error.response.status,
      statusText: error.response.statusText,
      url: error.config?.url,
      method: error.config?.method,
    };
  }

  return enhancedError;
};

/**
 * 日志查询器
 */
const queryLogs = async (options = {}) => {
  const {
    level = "info",
    from = new Date(Date.now() - 24 * 60 * 60 * 1000), // 默认过去24小时
    to = new Date(),
    limit = 100,
    type = null,
  } = options;

  return new Promise((resolve, reject) => {
    const queryOptions = {
      from,
      until: to,
      limit,
      start: 0,
      order: "desc",
      fields: ["timestamp", "level", "message", "meta"],
    };

    logger.query(queryOptions, (err, results) => {
      if (err) {
        reject(err);
      } else {
        let logs = results.file || [];

        // 按类型过滤
        if (type) {
          logs = logs.filter((log) => log.meta?.type === type);
        }

        resolve(logs);
      }
    });
  });
};

/**
 * 日志统计器
 */
const getLogStats = async (timeRange = 24) => {
  try {
    const from = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    const logs = await queryLogs({ from, limit: 10000 });

    const stats = {
      total: logs.length,
      byLevel: {},
      byType: {},
      errors: 0,
      warnings: 0,
      timeRange: `${timeRange}h`,
      mostCommonErrors: {},
    };

    logs.forEach((log) => {
      // 按级别统计
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // 按类型统计
      if (log.meta?.type) {
        stats.byType[log.meta.type] = (stats.byType[log.meta.type] || 0) + 1;
      }

      // 错误和警告计数
      if (log.level === "error") stats.errors++;
      if (log.level === "warn") stats.warnings++;

      // 常见错误统计
      if (log.level === "error" && log.message) {
        const errorKey = log.message.substring(0, 50);
        stats.mostCommonErrors[errorKey] = (stats.mostCommonErrors[errorKey] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    logger.error("获取日志统计失败:", error);
    return null;
  }
};

/**
 * 日志清理器
 */
const cleanupOldLogs = (daysToKeep = 30) => {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  // 这里可以实现实际的日志清理逻辑
  logger.info("日志清理任务执行", {
    type: "system_maintenance",
    cutoffDate: cutoffDate.toISOString(),
    daysToKeep,
  });
};

module.exports = {
  logger,
  logApiAccess,
  logSecurityEvent,
  logPerformance,
  logUserActivity,
  logDatabaseOperation,
  logExternalApiCall,
  enhanceError,
  queryLogs,
  getLogStats,
  cleanupOldLogs,
};
