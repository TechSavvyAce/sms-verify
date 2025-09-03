const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

async function addExpiredStatus() {
  try {
    console.log("开始添加expired状态...");

    // 检查是否已经存在expired状态
    const [results] = await sequelize.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'transactions' 
      AND COLUMN_NAME = 'status'
    `);

    if (results.length > 0) {
      const columnType = results[0].COLUMN_TYPE;
      if (columnType.includes("'expired'")) {
        console.log("✅ expired状态已存在");
        return;
      }
    }

    // 修改status字段以包含expired状态
    await sequelize.query(`
      ALTER TABLE transactions 
      MODIFY COLUMN status ENUM('pending', 'completed', 'failed', 'cancelled', 'expired') 
      DEFAULT 'completed'
    `);

    console.log("✅ 已添加expired状态");

    // 将超过24小时的pending交易标记为expired
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [updateResult] = await sequelize.query(
      `
      UPDATE transactions 
      SET status = 'expired' 
      WHERE type = 'recharge' 
      AND status = 'pending' 
      AND created_at < ?
    `,
      {
        replacements: [twentyFourHoursAgo],
      }
    );

    console.log(`✅ 已更新 ${updateResult.affectedRows} 条过期交易`);

    console.log("🎉 expired状态添加完成！");
  } catch (error) {
    console.error("❌ 添加expired状态失败:", error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addExpiredStatus()
    .then(() => {
      console.log("脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = addExpiredStatus;
