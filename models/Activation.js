const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Activation = sequelize.define(
  "Activation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    activation_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    service: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    country_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    cost: {
      type: DataTypes.DECIMAL(8, 4),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM("0", "1", "3", "6", "8"),
      allowNull: false,
      defaultValue: "0",
      comment: "0=等待短信, 1=等待重试, 3=收到短信, 6=已取消, 8=激活完成",
    },
    sms_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_check_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    check_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "activations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["user_id", "status"],
      },
      {
        unique: true,
        fields: ["activation_id"],
      },
      {
        fields: ["expires_at"],
      },
      {
        fields: ["created_at"],
      },
      {
        fields: ["service"],
      },
      {
        fields: ["country_id"],
      },
    ],
  }
);

// 实例方法
Activation.prototype.isExpired = function () {
  return this.expires_at && new Date() > this.expires_at;
};

Activation.prototype.canCancel = function () {
  // 检查状态是否允许取消
  if (!["0", "1"].includes(this.status)) {
    return false;
  }

  // 检查是否超过2分钟
  const now = new Date();
  const createdTime = new Date(this.created_at);
  const diffMinutes = (now - createdTime) / (1000 * 60);

  return diffMinutes >= 2; // 2分钟后才能取消
};

Activation.prototype.isCompleted = function () {
  return ["3", "8"].includes(this.status);
};

Activation.prototype.updateStatus = async function (newStatus, smsCode = null) {
  this.status = newStatus;
  if (smsCode) {
    this.sms_code = smsCode;
  }
  this.last_check_at = new Date();
  this.check_count += 1;
  await this.save();
};

module.exports = Activation;
