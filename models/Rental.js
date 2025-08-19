const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Rental = sequelize.define(
  "Rental",
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
    rental_id: {
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
    duration_hours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 168, // 最长7天
      },
    },
    status: {
      type: DataTypes.ENUM("active", "expired", "cancelled"),
      allowNull: false,
      defaultValue: "active",
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_check_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sms_received: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
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
    tableName: "rentals",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["user_id", "status"],
      },
      {
        unique: true,
        fields: ["rental_id"],
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
Rental.prototype.isExpired = function () {
  return new Date() > this.expires_at;
};

Rental.prototype.canCancel = function () {
  const now = new Date();
  const twentyMinutesAgo = new Date(this.created_at.getTime() + 20 * 60 * 1000);
  return this.status === "active" && now < twentyMinutesAgo;
};

Rental.prototype.addSms = async function (smsData) {
  const currentSms = this.sms_received || [];
  currentSms.push({
    ...smsData,
    received_at: new Date().toISOString(),
  });
  this.sms_received = currentSms;
  this.last_check_at = new Date();
  await this.save();
};

Rental.prototype.getRemainingTime = function () {
  const now = new Date();
  const remaining = Math.max(0, this.expires_at.getTime() - now.getTime());
  return Math.floor(remaining / (1000 * 60 * 60)); // 返回剩余小时数
};

module.exports = Rental;
