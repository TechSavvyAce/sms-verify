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
      allowNull: true, // 邮箱现在是可选的
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true, // 密码现在是可选的
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
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20],
      },
    },
    phone_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    phone_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    verification_code: {
      type: DataTypes.STRING(8),
      allowNull: true,
      validate: {
        len: [8, 8],
      },
      field: "email_verification_token",
    },
    verification_code_expires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "email_verification_expires",
    },

    country: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
      },
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        len: [0, 50],
      },
    },
    language: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: [0, 10],
      },
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: [0, 255],
      },
    },
    two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sms_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    push_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
  delete values.password_reset_token;
  delete values.password_reset_expires;

  // 重命名字段以保持API一致性
  if (values.email_verification_token) {
    values.verification_code = values.email_verification_token;
    delete values.email_verification_token;
  }
  if (values.email_verification_expires) {
    values.verification_code_expires = values.email_verification_expires;
    delete values.email_verification_expires;
  }

  return values;
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
  // 清除验证码（新系统使用 verification_code 而不是 email_verification_token）
  this.verification_code = null;
  this.verification_code_expires = null;
  await this.save();
};

User.prototype.verifySMS = async function () {
  this.phone_verified = true;
  this.status = "active";
  await this.save();
};

User.prototype.resetPassword = async function (newPassword) {
  this.password_hash = newPassword;
  this.password_reset_token = null;
  this.password_reset_expires = null;
  await this.save();
};

module.exports = User;
