#!/usr/bin/env node

require("dotenv").config();

const db = require("../config/database");
const logger = require("../utils/logger");
const seedSystemConfig = require("./seedSystemConfig");

/**
 * 数据库同步脚本
 * 用于初始化和同步数据库表结构
 */

class DatabaseSyncer {
  constructor() {
    this.options = {
      force: false,
      alter: false,
      seedData: false,
      backupBeforeSync: false,
    };
  }

  /**
   * 解析命令行参数
   */
  parseArguments() {
    const args = process.argv.slice(2);

    this.options.force = args.includes("--force");
    this.options.alter = args.includes("--alter");
    this.options.seedData = args.includes("--seed");
    this.options.backupBeforeSync = args.includes("--backup");

    const helpRequested = args.includes("--help") || args.includes("-h");

    if (helpRequested) {
      this.showHelp();
      process.exit(0);
    }

    return this.options;
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
数据库同步脚本

用法:
  node scripts/syncDatabase.js [选项]

选项:
  --force           强制重建所有表（会删除现有数据）
  --alter           修改现有表结构以匹配模型
  --seed            同步后插入种子数据
  --backup          同步前备份数据库
  --help, -h        显示此帮助信息

示例:
  node scripts/syncDatabase.js --alter --seed
  node scripts/syncDatabase.js --force --backup
  
注意:
  --force 会删除所有现有数据，请谨慎使用！
  在生产环境中建议使用 --alter 而不是 --force
    `);
  }

  /**
   * 检查数据库连接
   */
  async checkConnection() {
    try {
      await db.authenticate();
      logger.info("✅ 数据库连接成功");
      return true;
    } catch (error) {
      logger.error("❌ 数据库连接失败:", error);
      return false;
    }
  }

  /**
   * 备份数据库
   */
  async backupDatabase() {
    if (!this.options.backupBeforeSync) {
      return;
    }

    logger.info("📦 开始备份数据库...");

    try {
      const backupScript = require("./backup");
      await backupScript.createBackup();
      logger.info("✅ 数据库备份完成");
    } catch (error) {
      logger.error("❌ 数据库备份失败:", error);
      throw error;
    }
  }

  /**
   * 获取所有模型
   */
  getModels() {
    const models = require("../models");

    // 确保模型按依赖顺序返回
    const modelOrder = [
      "User",
      "SystemConfig",
      "UserActivityLog",
      "ApiKey",
      "Transaction",
      "Activation",
      "Rental",
    ];

    const orderedModels = {};

    modelOrder.forEach((modelName) => {
      if (models[modelName]) {
        orderedModels[modelName] = models[modelName];
      }
    });

    // 添加未在顺序中指定的模型
    Object.keys(models).forEach((modelName) => {
      if (!orderedModels[modelName] && typeof models[modelName] === "object") {
        orderedModels[modelName] = models[modelName];
      }
    });

    return orderedModels;
  }

  /**
   * 同步数据库表
   */
  async syncTables() {
    const models = this.getModels();
    const modelNames = Object.keys(models);

    logger.info(`📋 准备同步 ${modelNames.length} 个模型...`);
    logger.info(`模型列表: ${modelNames.join(", ")}`);

    if (this.options.force) {
      logger.warn("⚠️ 使用 --force 选项，将删除所有现有数据！");

      // 添加确认提示（仅在非CI环境）
      if (!process.env.CI && process.env.NODE_ENV !== "test") {
        const readline = require("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise((resolve) => {
          rl.question("确认删除所有数据并重建表? (yes/no): ", resolve);
        });

        rl.close();

        if (answer.toLowerCase() !== "yes") {
          logger.info("操作已取消");
          process.exit(0);
        }
      }
    }

    try {
      const syncOptions = {
        force: this.options.force,
        alter: this.options.alter,
        logging: (sql) => logger.debug(`SQL: ${sql}`),
      };

      logger.info(`🔄 数据库同步已禁用...`);
      logger.info(`同步选项: ${JSON.stringify(syncOptions, null, 2)}`);

      // Database sync removed as requested
      logger.info("✅ 数据库表同步已禁用");

      // 显示表信息
      await this.showTableInfo();
    } catch (error) {
      logger.error("❌ 数据库同步失败:", error);
      throw error;
    }
  }

  /**
   * 显示表信息
   */
  async showTableInfo() {
    try {
      const [tables] = await db.query("SHOW TABLES");

      logger.info("📊 数据库表信息:");
      console.log(`数据库: ${db.config.database}`);
      console.log(`总表数: ${tables.length}`);
      console.log("表列表:");

      for (const table of tables) {
        const tableName = Object.values(table)[0];

        try {
          const [rows] = await db.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
          const count = rows[0].count;
          console.log(`  • ${tableName}: ${count} 行`);
        } catch (error) {
          console.log(`  • ${tableName}: 无法获取行数`);
        }
      }
    } catch (error) {
      logger.warn("无法获取表信息:", error.message);
    }
  }

  /**
   * 插入种子数据
   */
  async seedData() {
    if (!this.options.seedData) {
      return;
    }

    logger.info("🌱 开始插入种子数据...");

    try {
      // 插入系统配置
      await seedSystemConfig();
      logger.info("✅ 系统配置种子数据插入完成");

      // 可以在这里添加其他种子数据
      await this.seedDevelopmentData();

      logger.info("✅ 所有种子数据插入完成");
    } catch (error) {
      logger.error("❌ 种子数据插入失败:", error);
      throw error;
    }
  }

  /**
   * 插入开发环境测试数据
   */
  async seedDevelopmentData() {
    if (process.env.NODE_ENV === "production") {
      logger.info("生产环境跳过测试数据插入");
      return;
    }

    const { User } = require("../models");
    const bcrypt = require("bcryptjs");

    try {
      // 检查是否已存在测试用户
      const existingUser = await User.findOne({
        where: { username: "admin" },
      });

      if (!existingUser) {
        const adminUser = await User.create({
          username: "admin",
          email: "admin@smsyz.online",
          password_hash: await bcrypt.hash("admin123", 10),
          status: "active",
          role: "admin",
          balance: 1000.0,
          total_spent: 0.0,
          total_recharged: 1000.0,
          email_verified: true,
        });

        logger.info(`✅ 创建管理员用户: ${adminUser.username}`);
      }

      // 创建测试用户
      const testUserExists = await User.findOne({
        where: { username: "testuser" },
      });

      if (!testUserExists) {
        const testUser = await User.create({
          username: "testuser",
          email: "test@smsyz.online",
          password_hash: await bcrypt.hash("test123", 10),
          status: "active",
          balance: 100.0,
          total_spent: 0.0,
          total_recharged: 100.0,
          email_verified: true,
        });

        logger.info(`✅ 创建测试用户: ${testUser.username}`);
      }
    } catch (error) {
      logger.warn("插入开发数据时出现错误:", error.message);
    }
  }

  /**
   * 验证数据库完整性
   */
  async validateDatabase() {
    logger.info("🔍 验证数据库完整性...");

    try {
      const models = this.getModels();
      const issues = [];

      for (const [modelName, model] of Object.entries(models)) {
        try {
          // 检查表是否存在
          await model.describe();

          // 检查基本查询是否工作
          await model.count();

          logger.info(`✅ ${modelName} 表验证通过`);
        } catch (error) {
          issues.push(`${modelName}: ${error.message}`);
          logger.error(`❌ ${modelName} 表验证失败:`, error.message);
        }
      }

      if (issues.length === 0) {
        logger.info("✅ 数据库完整性验证通过");
      } else {
        logger.error(`❌ 发现 ${issues.length} 个问题:`);
        issues.forEach((issue) => logger.error(`  • ${issue}`));
        throw new Error("数据库完整性验证失败");
      }
    } catch (error) {
      logger.error("数据库验证失败:", error);
      throw error;
    }
  }

  /**
   * 执行完整的同步流程
   */
  async execute() {
    const startTime = Date.now();

    try {
      logger.info("🚀 开始数据库同步流程...");

      // 解析参数
      this.parseArguments();

      // 检查连接
      const connected = await this.checkConnection();
      if (!connected) {
        throw new Error("无法连接到数据库");
      }

      // 备份（如果需要）
      await this.backupDatabase();

      // 同步表
      await this.syncTables();

      // 插入种子数据
      await this.seedData();

      // 验证数据库
      await this.validateDatabase();

      const duration = Date.now() - startTime;
      logger.info(`🎉 数据库同步完成！耗时: ${duration}ms`);

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`💥 数据库同步失败！耗时: ${duration}ms`);
      logger.error("错误详情:", error);

      return false;
    } finally {
      // 关闭数据库连接
      await db.close();
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const syncer = new DatabaseSyncer();
  const success = await syncer.execute();

  process.exit(success ? 0 : 1);
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 未捕获的错误:", error);
    process.exit(1);
  });
}

module.exports = { DatabaseSyncer };
