const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SystemConfig = sequelize.define(
  "SystemConfig",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    config_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    config_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "system_config",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["config_key"],
      },
    ],
  }
);

// 静态方法：获取配置值
SystemConfig.getConfig = async function (key, defaultValue = null) {
  try {
    const config = await this.findOne({ where: { config_key: key } });
    return config ? config.config_value : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

// 静态方法：设置配置值
SystemConfig.setConfig = async function (key, value, description = null) {
  try {
    await this.upsert({
      config_key: key,
      config_value: value,
      description,
      updated_at: new Date(),
    });
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = SystemConfig;
