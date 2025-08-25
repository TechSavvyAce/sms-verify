const winston = require("winston");
const path = require("path");

// 创建日志目录
const logDir = "logs";
require("fs").mkdirSync(logDir, { recursive: true });

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      try {
        // Safely stringify meta, handling circular references
        const safeMeta = JSON.parse(
          JSON.stringify(meta, (key, value) => {
            if (key === "req" || key === "res" || key === "socket" || key === "connection") {
              return "[Circular Reference]";
            }
            return value;
          })
        );
        msg += ` ${JSON.stringify(safeMeta)}`;
      } catch (error) {
        // If JSON.stringify fails, just show the keys
        msg += ` [Meta keys: ${Object.keys(meta).join(", ")}]`;
      }
    }
    return msg;
  })
);

// 创建 logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "sms-verify" },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 综合日志文件
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
    }),
  ],
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

module.exports = logger;
