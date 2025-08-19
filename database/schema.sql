-- SMS 中间件平台数据库架构 (MySQL 兼容版本)
-- 此版本兼容不同的 MySQL 版本和 SQL 模式

-- 设置 SQL 模式以兼容性
SET sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';

-- 创建数据库 (如果不存在)
CREATE DATABASE IF NOT EXISTS sms_verify DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE sms_verify;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL COMMENT '账户余额',
  total_spent DECIMAL(10,2) DEFAULT 0.00 NOT NULL COMMENT '总消费',
  total_recharged DECIMAL(10,2) DEFAULT 0.00 NOT NULL COMMENT '总充值',
  status ENUM('active', 'suspended', 'pending') DEFAULT 'active' NOT NULL COMMENT '账户状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新时间',
  last_login DATETIME NULL DEFAULT NULL COMMENT '最后登录时间',
  login_count INT DEFAULT 0 NOT NULL COMMENT '登录次数',
  
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  
  CONSTRAINT chk_balance CHECK (balance >= 0),
  CONSTRAINT chk_total_spent CHECK (total_spent >= 0),
  CONSTRAINT chk_total_recharged CHECK (total_recharged >= 0),
  CONSTRAINT chk_login_count CHECK (login_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- SMS 激活表
CREATE TABLE IF NOT EXISTS activations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  activation_id VARCHAR(50) NOT NULL UNIQUE COMMENT 'SMS-Activate激活ID',
  service VARCHAR(50) NOT NULL COMMENT '服务名称',
  country_id INT NOT NULL COMMENT '国家ID',
  phone_number VARCHAR(20) NULL COMMENT '手机号码',
  cost DECIMAL(8,4) NOT NULL COMMENT '费用',
  status ENUM('0','1','3','6','8') DEFAULT '0' NOT NULL COMMENT '状态: 0=等待短信, 1=等待重试, 3=收到短信, 6=已取消, 8=激活完成',
  sms_code VARCHAR(20) NULL COMMENT '短信验证码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新时间',
  expires_at DATETIME NULL DEFAULT NULL COMMENT '过期时间',
  last_check_at DATETIME NULL DEFAULT NULL COMMENT '最后检查时间',
  check_count INT DEFAULT 0 NOT NULL COMMENT '检查次数',
  
  FOREIGN KEY fk_activations_user (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_activation_id (activation_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_created_at (created_at),
  INDEX idx_service (service),
  INDEX idx_country_id (country_id),
  
  CONSTRAINT chk_activation_cost CHECK (cost >= 0),
  CONSTRAINT chk_activation_check_count CHECK (check_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SMS激活记录表';

-- 手机号租用表
CREATE TABLE IF NOT EXISTS rentals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  rental_id VARCHAR(50) NOT NULL UNIQUE COMMENT 'SMS-Activate租用ID',
  service VARCHAR(50) NOT NULL COMMENT '服务名称',
  country_id INT NOT NULL COMMENT '国家ID',
  phone_number VARCHAR(20) NULL COMMENT '手机号码',
  cost DECIMAL(8,4) NOT NULL COMMENT '费用',
  duration_hours INT NOT NULL COMMENT '租用时长(小时)',
  status ENUM('active', 'expired', 'cancelled') DEFAULT 'active' NOT NULL COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新时间',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  last_check_at DATETIME NULL DEFAULT NULL COMMENT '最后检查时间',
  sms_received JSON NULL COMMENT '收到的短信列表',
  
  FOREIGN KEY fk_rentals_user (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_rental_id (rental_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_created_at (created_at),
  INDEX idx_service (service),
  INDEX idx_country_id (country_id),
  
  CONSTRAINT chk_rental_cost CHECK (cost >= 0),
  CONSTRAINT chk_rental_duration CHECK (duration_hours > 0 AND duration_hours <= 168)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='手机号租用记录表';

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  type ENUM('recharge', 'activation', 'rental', 'refund') NOT NULL COMMENT '交易类型',
  amount DECIMAL(10,2) NOT NULL COMMENT '交易金额',
  balance_before DECIMAL(10,2) NOT NULL COMMENT '交易前余额',
  balance_after DECIMAL(10,2) NOT NULL COMMENT '交易后余额',
  reference_id VARCHAR(100) NULL COMMENT '关联ID',
  description TEXT NULL COMMENT '交易描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '创建时间',
  
  FOREIGN KEY fk_transactions_user (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, type),
  INDEX idx_created_at (created_at),
  INDEX idx_reference_id (reference_id),
  INDEX idx_type (type),
  
  CONSTRAINT chk_transaction_balance_before CHECK (balance_before >= 0),
  CONSTRAINT chk_transaction_balance_after CHECK (balance_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易记录表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
  config_value TEXT NOT NULL COMMENT '配置值',
  description TEXT NULL COMMENT '配置描述',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新时间',
  
  INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 用户活动日志表
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL COMMENT '用户ID (可为空，针对匿名访问)',
  action VARCHAR(100) NOT NULL COMMENT '操作类型',
  ip_address VARCHAR(45) NULL COMMENT 'IP地址',
  user_agent TEXT NULL COMMENT '用户代理',
  details JSON NULL COMMENT '详细信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '创建时间',
  
  FOREIGN KEY fk_activity_user (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_created (user_id, created_at),
  INDEX idx_action_created (action, created_at),
  INDEX idx_created_at (created_at),
  INDEX idx_ip_address (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户活动日志表';

-- 插入默认系统配置 (使用 INSERT IGNORE 避免重复)
INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
('price_markup_percent', '20', '价格加价百分比'),
('max_activations_per_day', '50', '每日最大激活次数'),
('max_rentals_per_day', '10', '每日最大租用次数'),
('activation_timeout_minutes', '20', '激活超时时间(分钟)'),
('min_balance_threshold', '10', '最低余额警告阈值'),
('refund_policy_minutes', '20', '退款政策时限(分钟)'),
('maintenance_mode', 'false', '维护模式开关'),
('welcome_message', '欢迎使用短信验证平台！', '欢迎消息'),
('support_email', 'support@example.com', '客服邮箱'),
('api_rate_limit_per_minute', '100', '每分钟API请求限制');

-- 创建视图：用户统计视图
CREATE OR REPLACE VIEW user_stats_view AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.status,
    u.balance,
    u.total_spent,
    u.total_recharged,
    u.created_at,
    u.last_login,
    u.login_count,
    COALESCE(a.activation_count, 0) as activation_count,
    COALESCE(r.rental_count, 0) as rental_count,
    COALESCE(t.transaction_count, 0) as transaction_count
FROM users u
LEFT JOIN (
    SELECT user_id, COUNT(*) as activation_count 
    FROM activations 
    GROUP BY user_id
) a ON u.id = a.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as rental_count 
    FROM rentals 
    GROUP BY user_id
) r ON u.id = r.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as transaction_count 
    FROM transactions 
    GROUP BY user_id
) t ON u.id = t.user_id;

-- 创建视图：服务统计视图
CREATE OR REPLACE VIEW service_stats_view AS
SELECT 
    service,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status IN ('3', '8') THEN 1 END) as success_count,
    COUNT(CASE WHEN status = '6' THEN 1 END) as cancelled_count,
    ROUND(AVG(cost), 4) as avg_cost,
    ROUND(SUM(cost), 2) as total_revenue,
    ROUND(
        COUNT(CASE WHEN status IN ('3', '8') THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate
FROM activations
GROUP BY service
ORDER BY total_count DESC;

-- 创建视图：国家统计视图
CREATE OR REPLACE VIEW country_stats_view AS
SELECT 
    country_id,
    COUNT(DISTINCT service) as services_count,
    COUNT(*) as total_activations,
    COUNT(CASE WHEN status IN ('3', '8') THEN 1 END) as success_count,
    ROUND(AVG(cost), 4) as avg_cost,
    ROUND(
        COUNT(CASE WHEN status IN ('3', '8') THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate
FROM activations
GROUP BY country_id
ORDER BY total_activations DESC;

-- 显示成功信息
SELECT 'Database schema created successfully!' as status;
