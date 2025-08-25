const sequelize = require("../config/database");
const logger = require("../utils/logger");

async function fixDatabaseKeys() {
  try {
    await sequelize.authenticate();
    logger.info("数据库连接成功，开始修复数据库键限制问题...");

    // Check current table structure
    const [results] = await sequelize.query(`
      SELECT 
        TABLE_NAME,
        INDEX_NAME,
        COLUMN_NAME,
        NON_UNIQUE,
        SEQ_IN_INDEX
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || "sms_verify"}'
      AND TABLE_NAME = 'users'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX;
    `);

    logger.info(`当前 users 表有 ${results.length} 个索引/键`);

    if (results.length >= 60) {
      logger.warn("警告：users 表接近 MySQL 64 键限制！");

      // List all indexes
      results.forEach((row, index) => {
        logger.info(
          `${index + 1}. ${row.INDEX_NAME} (${row.COLUMN_NAME}) - Unique: ${!row.NON_UNIQUE}`
        );
      });
    }

    // Check if email unique constraint exists
    const emailUniqueIndex = results.find(
      (row) => row.COLUMN_NAME === "email" && row.INDEX_NAME.includes("email") && !row.NON_UNIQUE
    );

    if (emailUniqueIndex) {
      logger.info("发现 email 唯一约束，正在移除...");

      // Remove email unique constraint
      await sequelize.query(`
        ALTER TABLE users DROP INDEX ${emailUniqueIndex.INDEX_NAME};
      `);

      logger.info("email 唯一约束已移除");
    } else {
      logger.info("email 字段没有唯一约束，无需处理");
    }

    // Verify the fix
    const [afterResults] = await sequelize.query(`
      SELECT COUNT(*) as key_count
      FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || "sms_verify"}'
      AND TABLE_NAME = 'users';
    `);

    logger.info(`修复后 users 表有 ${afterResults[0].key_count} 个键`);
    logger.info("数据库键限制问题修复完成！");
  } catch (error) {
    logger.error("修复数据库键限制失败:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the migration if called directly
if (require.main === module) {
  fixDatabaseKeys()
    .then(() => {
      logger.info("数据库修复脚本执行完成");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("数据库修复脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = { fixDatabaseKeys };
