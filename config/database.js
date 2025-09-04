const { Sequelize } = require("sequelize");
const logger = require("../utils/logger");

// 规范化主机，避免在 Windows 上将 "localhost" 解析为 IPv6 (::1)
const rawHost = process.env.DB_HOST || "127.0.0.1";
const normalizedHost = rawHost === "localhost" || rawHost === "::1" ? "127.0.0.1" : rawHost;

const sequelize = new Sequelize(
  process.env.DB_NAME || "sms_verify",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: normalizedHost,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? (msg) => logger.debug(msg) : false,
    pool: {
      max: 20,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
    dialectOptions: {
      charset: "utf8mb4",
    },
    timezone: "+08:00", // 中国时区
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
    },
  }
);

module.exports = sequelize;
