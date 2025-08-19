const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Transaction = sequelize.define(
  "Transaction",
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
    type: {
      type: DataTypes.ENUM("recharge", "activation", "rental", "refund"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    balance_before: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    reference_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "transactions",
    timestamps: false,
    indexes: [
      {
        fields: ["user_id", "type"],
      },
      {
        fields: ["created_at"],
      },
      {
        fields: ["reference_id"],
      },
      {
        fields: ["type"],
      },
    ],
  }
);

module.exports = Transaction;
