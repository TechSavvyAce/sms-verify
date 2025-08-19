-- 数据库状态检查脚本
-- 运行此脚本检查当前数据库状态

-- 检查数据库是否存在
SHOW DATABASES LIKE '%sms%';

-- 使用数据库
USE sms_verify;

-- 检查所有表
SHOW TABLES;

-- 检查表结构
DESCRIBE users;
DESCRIBE activations;
DESCRIBE rentals;
DESCRIBE transactions;
DESCRIBE system_config;
DESCRIBE user_activity_logs;

-- 检查表的行数
SELECT 
    'users' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM users
UNION ALL
SELECT 
    'activations' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM activations
UNION ALL
SELECT 
    'rentals' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM rentals
UNION ALL
SELECT 
    'transactions' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM transactions
UNION ALL
SELECT 
    'system_config' as table_name, 
    COUNT(*) as row_count,
    MAX(updated_at) as last_created
FROM system_config
UNION ALL
SELECT 
    'user_activity_logs' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM user_activity_logs;

-- 检查视图
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- 检查系统配置
SELECT * FROM system_config ORDER BY config_key;

-- 检查用户账户状态
SELECT 
    status,
    COUNT(*) as user_count,
    SUM(balance) as total_balance,
    AVG(balance) as avg_balance
FROM users 
GROUP BY status;
