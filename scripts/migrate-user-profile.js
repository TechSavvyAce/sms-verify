const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const logger = require("../utils/logger");

async function migrateUserProfile() {
  try {
    logger.info("开始迁移用户资料表...");

    // 检查并添加新字段
    const newFields = [
      {
        name: "phone",
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      {
        name: "country",
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      {
        name: "timezone",
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      {
        name: "language",
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      {
        name: "avatar",
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      {
        name: "two_factor_enabled",
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      {
        name: "email_notifications",
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      {
        name: "sms_notifications",
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      {
        name: "push_notifications",
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    ];

    // 获取表信息
    const tableInfo = await sequelize.getQueryInterface().describeTable("users");

    for (const field of newFields) {
      if (!tableInfo[field.name]) {
        logger.info(`添加字段: ${field.name}`);

        // 添加字段
        await sequelize.getQueryInterface().addColumn("users", field.name, {
          type: field.type,
          allowNull: field.allowNull,
          defaultValue: field.defaultValue,
        });

        logger.info(`字段 ${field.name} 添加成功`);
      } else {
        logger.info(`字段 ${field.name} 已存在，跳过`);
      }
    }

    logger.info("用户资料表迁移完成！");

    // 显示当前表结构
    const updatedTableInfo = await sequelize.getQueryInterface().describeTable("users");
    logger.info("当前表结构:", Object.keys(updatedTableInfo));
  } catch (error) {
    logger.error("迁移失败:", error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateUserProfile()
    .then(() => {
      logger.info("迁移完成");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("迁移失败:", error);
      process.exit(1);
    });
}

module.exports = migrateUserProfile;
