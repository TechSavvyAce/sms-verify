const { DataTypes } = require("sequelize");
const crypto = require("crypto");
const sequelize = require("../config/database");

const ApiKey = sequelize.define(
  "ApiKey",
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    key_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    key_preview: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "前8位和后8位，用于显示",
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ["read"],
      validate: {
        isValidPermissions(value) {
          const validPermissions = ["read", "write", "admin"];
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error("权限必须是非空数组");
          }
          for (const perm of value) {
            if (!validPermissions.includes(perm)) {
              throw new Error(`无效的权限: ${perm}`);
            }
          }
        },
      },
    },
    status: {
      type: DataTypes.ENUM("active", "disabled"),
      allowNull: false,
      defaultValue: "active",
    },
    last_used: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_used_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "API密钥过期时间，null表示永不过期",
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
    tableName: "api_keys",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["user_id"],
      },
      {
        fields: ["key_hash"],
        unique: true,
      },
      {
        fields: ["status"],
      },
      {
        fields: ["expires_at"],
      },
    ],
  }
);

// 生成API密钥
ApiKey.generateKey = function () {
  const prefix = "sk_";
  const keyPart = crypto.randomBytes(32).toString("hex");
  return prefix + keyPart;
};

// 哈希API密钥
ApiKey.hashKey = function (key) {
  return crypto.createHash("sha256").update(key).digest("hex");
};

// 生成密钥预览
ApiKey.generatePreview = function (key) {
  if (key.length < 16) return key;
  return key.substring(0, 8) + "..." + key.substring(key.length - 8);
};

// 创建API密钥的静态方法
ApiKey.createKey = async function (
  userId,
  name,
  permissions = ["read"],
  expiresAt = null
) {
  const key = this.generateKey();
  const keyHash = this.hashKey(key);
  const keyPreview = this.generatePreview(key);

  const apiKey = await this.create({
    user_id: userId,
    name,
    key_hash: keyHash,
    key_preview: keyPreview,
    permissions,
    expires_at: expiresAt,
  });

  // 返回API密钥对象和明文密钥（仅此一次）
  return {
    apiKey,
    plainKey: key,
  };
};

// 验证API密钥
ApiKey.validateKey = async function (key) {
  const keyHash = this.hashKey(key);

  const apiKey = await this.findOne({
    where: {
      key_hash: keyHash,
      status: "active",
    },
    include: [
      {
        model: sequelize.models.User,
        as: "user",
        attributes: ["id", "username", "email", "status"],
      },
    ],
  });

  if (!apiKey) {
    return null;
  }

  // 检查是否过期
  if (apiKey.expires_at && new Date() > apiKey.expires_at) {
    return null;
  }

  // 检查用户状态
  if (apiKey.user.status !== "active") {
    return null;
  }

  return apiKey;
};

// 更新使用信息
ApiKey.prototype.updateUsage = async function (ip) {
  this.last_used = new Date();
  this.last_used_ip = ip;
  this.usage_count += 1;
  await this.save();
};

// 检查权限
ApiKey.prototype.hasPermission = function (permission) {
  return (
    this.permissions.includes(permission) || this.permissions.includes("admin")
  );
};

// 实例方法：检查是否过期
ApiKey.prototype.isExpired = function () {
  return this.expires_at && new Date() > this.expires_at;
};

// 不返回敏感信息
ApiKey.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.key_hash;
  return values;
};

module.exports = ApiKey;
