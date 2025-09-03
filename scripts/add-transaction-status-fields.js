const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

async function addTransactionStatusFields() {
  try {
    console.log("开始添加交易状态字段...");

    // 添加 status 字段
    await sequelize.query(`
      ALTER TABLE transactions 
      ADD COLUMN status ENUM('pending', 'completed', 'failed', 'cancelled', 'expired') 
      DEFAULT 'completed' AFTER description
    `);

    console.log("✅ 已添加 status 字段");

    // 添加 completed_at 字段
    await sequelize.query(`
      ALTER TABLE transactions 
      ADD COLUMN completed_at DATETIME NULL AFTER status
    `);

    console.log("✅ 已添加 completed_at 字段");

    // 为现有的充值交易设置状态
    await sequelize.query(`
      UPDATE transactions 
      SET status = 'completed', completed_at = created_at 
      WHERE type = 'recharge' AND status IS NULL
    `);

    console.log("✅ 已更新现有充值交易状态");

    // 为其他类型的交易设置状态
    await sequelize.query(`
      UPDATE transactions 
      SET status = 'completed', completed_at = created_at 
      WHERE type != 'recharge' AND status IS NULL
    `);

    console.log("✅ 已更新其他交易状态");

    console.log("🎉 交易状态字段添加完成！");
  } catch (error) {
    console.error("❌ 添加交易状态字段失败:", error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addTransactionStatusFields()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = addTransactionStatusFields;
