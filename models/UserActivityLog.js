const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserActivityLog = sequelize.define(
  "UserActivityLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "user_activity_logs",
    timestamps: false,
    indexes: [
      {
        fields: ["user_id", "created_at"],
      },
      {
        fields: ["action", "created_at"],
      },
      {
        fields: ["created_at"],
      },
      {
        fields: ["ip_address"],
      },
    ],
  }
);

// 静态方法：记录用户活动
UserActivityLog.logActivity = async function (data) {
  try {
    await this.create({
      user_id: data.userId || null,
      action: data.action,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      details: data.details || null,
      created_at: new Date(),
    });
    return true;
  } catch (error) {
    console.error("Failed to log user activity:", error);
    return false;
  }
};

module.exports = UserActivityLog;
