const User = require("./User");
const Activation = require("./Activation");
const Rental = require("./Rental");
const Transaction = require("./Transaction");
const SystemConfig = require("./SystemConfig");
const UserActivityLog = require("./UserActivityLog");
const ApiKey = require("./ApiKey");
const PricingOverride = require("./PricingOverride");

// 定义关联关系
User.hasMany(Activation, {
  foreignKey: "user_id",
  as: "activations",
});

User.hasMany(Rental, {
  foreignKey: "user_id",
  as: "rentals",
});

User.hasMany(Transaction, {
  foreignKey: "user_id",
  as: "transactions",
});

Activation.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

Rental.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

Transaction.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

User.hasMany(UserActivityLog, {
  foreignKey: "user_id",
  as: "activityLogs",
});

UserActivityLog.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// API Key 关联
User.hasMany(ApiKey, {
  foreignKey: "user_id",
  as: "apiKeys",
});

ApiKey.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

module.exports = {
  User,
  Activation,
  Rental,
  Transaction,
  SystemConfig,
  UserActivityLog,
  ApiKey,
  PricingOverride,
};
