const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    total_spent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    total_recharged: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM("active", "suspended", "pending"),
      allowNull: false,
      defaultValue: "pending",
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email_verification_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    login_count: {
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
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

// 密码加密钩子
User.addHook("beforeCreate", async (user) => {
  if (user.password_hash) {
    const salt = await bcrypt.genSalt(12);
    user.password_hash = await bcrypt.hash(user.password_hash, salt);
  }
});

User.addHook("beforeUpdate", async (user) => {
  if (user.changed("password_hash")) {
    const salt = await bcrypt.genSalt(12);
    user.password_hash = await bcrypt.hash(user.password_hash, salt);
  }
});

// 实例方法
User.prototype.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.password_hash);
};

User.prototype.updateLoginInfo = async function () {
  this.last_login = new Date();
  this.login_count += 1;
  await this.save();
};

User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password_hash;
  delete values.email_verification_token;
  delete values.password_reset_token;
  return values;
};

User.prototype.generateEmailVerificationToken = function () {
  const crypto = require("crypto");
  this.email_verification_token = crypto.randomBytes(32).toString("hex");
  this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
  return this.email_verification_token;
};

User.prototype.generatePasswordResetToken = function () {
  const crypto = require("crypto");
  this.password_reset_token = crypto.randomBytes(32).toString("hex");
  this.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期
  return this.password_reset_token;
};

User.prototype.verifyEmail = async function () {
  this.email_verified = true;
  this.status = "active";
  this.email_verification_token = null;
  this.email_verification_expires = null;
  await this.save();
};

User.prototype.resetPassword = async function (newPassword) {
  this.password_hash = newPassword;
  this.password_reset_token = null;
  this.password_reset_expires = null;
  await this.save();
};

module.exports = User;
