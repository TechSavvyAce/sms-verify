/*
 Navicat Premium Dump SQL

 Source Server         : localhost
 Source Server Type    : MySQL
 Source Server Version : 100432 (10.4.32-MariaDB)
 Source Host           : 127.0.0.1:3306
 Source Schema         : sms_verify

 Target Server Type    : MySQL
 Target Server Version : 100432 (10.4.32-MariaDB)
 File Encoding         : 65001

 Date: 22/08/2025 10:04:26
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for activations
-- ----------------------------
DROP TABLE IF EXISTS `activations`;
CREATE TABLE `activations`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `activation_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `country_id` int NOT NULL,
  `phone_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `cost` decimal(8, 4) NOT NULL,
  `status` enum('0','1','3','6','8') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '0' COMMENT '0=等待短信, 1=等待重试, 3=收到短信, 6=已取消, 8=激活完成',
  `sms_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `expires_at` datetime NULL DEFAULT NULL,
  `last_check_at` datetime NULL DEFAULT NULL,
  `check_count` int NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `activation_id`(`activation_id` ASC) USING BTREE,
  UNIQUE INDEX `activations_activation_id`(`activation_id` ASC) USING BTREE,
  INDEX `activations_user_id_status`(`user_id` ASC, `status` ASC) USING BTREE,
  INDEX `activations_expires_at`(`expires_at` ASC) USING BTREE,
  INDEX `activations_created_at`(`created_at` ASC) USING BTREE,
  INDEX `activations_service`(`service` ASC) USING BTREE,
  INDEX `activations_country_id`(`country_id` ASC) USING BTREE,
  CONSTRAINT `activations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for api_keys
-- ----------------------------
DROP TABLE IF EXISTS `api_keys`;
CREATE TABLE `api_keys`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `key_preview` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '前8位和后8位，用于显示',
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` enum('active','disabled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `last_used` datetime NULL DEFAULT NULL,
  `last_used_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `usage_count` int NOT NULL DEFAULT 0,
  `expires_at` datetime NULL DEFAULT NULL COMMENT 'API密钥过期时间，null表示永不过期',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `key_hash`(`key_hash` ASC) USING BTREE,
  UNIQUE INDEX `api_keys_key_hash`(`key_hash` ASC) USING BTREE,
  INDEX `api_keys_user_id`(`user_id` ASC) USING BTREE,
  INDEX `api_keys_status`(`status` ASC) USING BTREE,
  INDEX `api_keys_expires_at`(`expires_at` ASC) USING BTREE,
  CONSTRAINT `api_keys_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for rentals
-- ----------------------------
DROP TABLE IF EXISTS `rentals`;
CREATE TABLE `rentals`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `rental_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `country_id` int NOT NULL,
  `phone_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `cost` decimal(8, 4) NOT NULL,
  `duration_hours` int NOT NULL,
  `status` enum('active','expired','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `expires_at` datetime NOT NULL,
  `last_check_at` datetime NULL DEFAULT NULL,
  `sms_received` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `rental_id`(`rental_id` ASC) USING BTREE,
  UNIQUE INDEX `rentals_rental_id`(`rental_id` ASC) USING BTREE,
  INDEX `rentals_user_id_status`(`user_id` ASC, `status` ASC) USING BTREE,
  INDEX `rentals_expires_at`(`expires_at` ASC) USING BTREE,
  INDEX `rentals_created_at`(`created_at` ASC) USING BTREE,
  INDEX `rentals_service`(`service` ASC) USING BTREE,
  INDEX `rentals_country_id`(`country_id` ASC) USING BTREE,
  CONSTRAINT `rentals_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for system_config
-- ----------------------------
DROP TABLE IF EXISTS `system_config`;
CREATE TABLE `system_config`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `config_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `config_key`(`config_key` ASC) USING BTREE,
  UNIQUE INDEX `system_config_config_key`(`config_key` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1471 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for transactions
-- ----------------------------
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` enum('recharge','activation','rental','refund') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `balance_before` decimal(10, 2) NOT NULL,
  `balance_after` decimal(10, 2) NOT NULL,
  `reference_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `transactions_user_id_type`(`user_id` ASC, `type` ASC) USING BTREE,
  INDEX `transactions_created_at`(`created_at` ASC) USING BTREE,
  INDEX `transactions_reference_id`(`reference_id` ASC) USING BTREE,
  INDEX `transactions_type`(`type` ASC) USING BTREE,
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for user_activity_logs
-- ----------------------------
DROP TABLE IF EXISTS `user_activity_logs`;
CREATE TABLE `user_activity_logs`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NULL DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `user_activity_logs_user_id_created_at`(`user_id` ASC, `created_at` ASC) USING BTREE,
  INDEX `user_activity_logs_action_created_at`(`action` ASC, `created_at` ASC) USING BTREE,
  INDEX `user_activity_logs_created_at`(`created_at` ASC) USING BTREE,
  INDEX `user_activity_logs_ip_address`(`ip_address` ASC) USING BTREE,
  CONSTRAINT `user_activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '邮箱 (可选)',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '密码哈希 (可选)',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '手机号码 (可选)',
  `phone_verified` tinyint(1) NOT NULL DEFAULT 0 COMMENT '手机是否已验证',
  `phone_verified_at` datetime NULL DEFAULT NULL COMMENT '手机验证时间',

  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '国家/地区',
  `timezone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '时区',
  `language` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'zh-CN' COMMENT '语言偏好',
  `avatar` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT '头像URL',
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否启用双因素认证',
  `email_notifications` tinyint(1) NOT NULL DEFAULT 1 COMMENT '邮件通知设置',
  `sms_notifications` tinyint(1) NOT NULL DEFAULT 1 COMMENT '短信通知设置',
  `push_notifications` tinyint(1) NOT NULL DEFAULT 1 COMMENT '推送通知设置',
  `balance` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `total_spent` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `total_recharged` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `status` enum('active','suspended','pending') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `email_verification_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `email_verification_expires` datetime NULL DEFAULT NULL,
  `password_reset_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `password_reset_expires` datetime NULL DEFAULT NULL,
  `last_login` datetime NULL DEFAULT NULL,
  `login_count` int NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE,
  UNIQUE INDEX `email`(`email` ASC) USING BTREE,
  UNIQUE INDEX `phone`(`phone` ASC) USING BTREE,

  INDEX `users_status`(`status` ASC) USING BTREE,
  INDEX `users_created_at`(`created_at` ASC) USING BTREE,
  INDEX `users_phone_verified`(`phone_verified` ASC) USING BTREE,

  INDEX `users_country`(`country` ASC) USING BTREE,
  INDEX `users_two_factor_enabled`(`two_factor_enabled` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- View structure for country_stats_view
-- ----------------------------
DROP VIEW IF EXISTS `country_stats_view`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `country_stats_view` AS SELECT 
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
ORDER BY total_activations DESC ;

-- ----------------------------
-- View structure for service_stats_view
-- ----------------------------
DROP VIEW IF EXISTS `service_stats_view`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `service_stats_view` AS SELECT 
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
ORDER BY total_count DESC ;

-- ----------------------------
-- View structure for user_stats_view
-- ----------------------------
DROP VIEW IF EXISTS `user_stats_view`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `user_stats_view` AS SELECT 
    u.id,
    u.username,
    u.email,
    u.phone,

    u.phone_verified,

    u.country,
    u.language,
    u.two_factor_enabled,
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
) t ON u.id = t.user_id ;

-- ----------------------------
-- Procedure structure for SafeAddColumn
-- ----------------------------
DROP PROCEDURE IF EXISTS `SafeAddColumn`;
delimiter ;;
CREATE PROCEDURE `SafeAddColumn`(IN table_name VARCHAR(64),
    IN column_name VARCHAR(64), 
    IN column_definition TEXT)
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_exists
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = table_name
    AND COLUMN_NAME = column_name;
    
    IF column_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' ADD COLUMN ', column_name, ' ', column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Added column: ', column_name) as result;
    ELSE
        SELECT CONCAT('⚠️  Column already exists: ', column_name) as result;
    END IF;
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for SafeAddIndex
-- ----------------------------
DROP PROCEDURE IF EXISTS `SafeAddIndex`;
delimiter ;;
CREATE PROCEDURE `SafeAddIndex`(IN table_name VARCHAR(64),
    IN index_name VARCHAR(64),
    IN column_name VARCHAR(64))
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_exists
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = table_name
    AND INDEX_NAME = index_name;
    
    IF index_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' ADD INDEX ', index_name, ' (', column_name, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Added index: ', index_name) as result;
    ELSE
        SELECT CONCAT('⚠️  Index already exists: ', index_name) as result;
    END IF;
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for SafeDropColumn
-- ----------------------------
DROP PROCEDURE IF EXISTS `SafeDropColumn`;
delimiter ;;
CREATE PROCEDURE `SafeDropColumn`(IN table_name VARCHAR(64),
    IN column_name VARCHAR(64))
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_exists
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = table_name
    AND COLUMN_NAME = column_name;
    
    IF column_exists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' DROP COLUMN ', column_name);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Dropped column: ', column_name) as result;
    ELSE
        SELECT CONCAT('⚠️  Column does not exist: ', column_name) as result;
    END IF;
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for SafeDropIndex
-- ----------------------------
DROP PROCEDURE IF EXISTS `SafeDropIndex`;
delimiter ;;
CREATE PROCEDURE `SafeDropIndex`(IN table_name VARCHAR(64),
    IN index_name VARCHAR(64))
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_exists
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = table_name
    AND INDEX_NAME = index_name;
    
    IF index_exists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' DROP INDEX ', index_name);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Dropped index: ', index_name) as result;
    ELSE
        SELECT CONCAT('⚠️  Index does not exist: ', index_name) as result;
    END IF;
END
;;
delimiter ;

-- ----------------------------
-- Procedure structure for SafeModifyColumn
-- ----------------------------
DROP PROCEDURE IF EXISTS `SafeModifyColumn`;
delimiter ;;
CREATE PROCEDURE `SafeModifyColumn`(IN table_name VARCHAR(64),
    IN column_name VARCHAR(64),
    IN column_definition TEXT)
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_exists
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = table_name
    AND COLUMN_NAME = column_name;
    
    IF column_exists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' MODIFY COLUMN ', column_name, ' ', column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✅ Modified column: ', column_name) as result;
    ELSE
        SELECT CONCAT('⚠️  Column does not exist: ', column_name) as result;
    END IF;
END
;;
delimiter ;

SET FOREIGN_KEY_CHECKS = 1;
