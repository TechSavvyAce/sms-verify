const { SystemConfig } = require("../models");
const logger = require("../utils/logger");

const defaultConfigs = [
  {
    config_key: "price_markup_percent",
    config_value: "20",
    description: "价格加价百分比",
  },
  {
    config_key: "max_activations_per_day",
    config_value: "50",
    description: "每日最大激活次数",
  },
  {
    config_key: "max_rentals_per_day",
    config_value: "10",
    description: "每日最大租用次数",
  },
  {
    config_key: "activation_timeout_minutes",
    config_value: "20",
    description: "激活超时时间(分钟)",
  },
  {
    config_key: "min_balance_threshold",
    config_value: "10",
    description: "最低余额警告阈值",
  },
  {
    config_key: "refund_policy_minutes",
    config_value: "20",
    description: "退款政策时限(分钟)",
  },
  {
    config_key: "maintenance_mode",
    config_value: "false",
    description: "维护模式开关",
  },
  {
    config_key: "welcome_message",
    config_value: "欢迎使用短信验证平台！",
    description: "欢迎消息",
  },
  {
    config_key: "support_email",
    config_value: "support@example.com",
    description: "客服邮箱",
  },
  {
    config_key: "api_rate_limit_per_minute",
    config_value: "100",
    description: "每分钟API请求限制",
  },
];

async function seedSystemConfig() {
  try {
    logger.info("开始初始化系统配置...");

    for (const config of defaultConfigs) {
      await SystemConfig.setConfig(
        config.config_key,
        config.config_value,
        config.description
      );
    }

    logger.info("系统配置初始化完成");
    return true;
  } catch (error) {
    logger.error("系统配置初始化失败:", error);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedSystemConfig()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error("脚本执行失败:", error);
      process.exit(1);
    });
}

module.exports = seedSystemConfig;
