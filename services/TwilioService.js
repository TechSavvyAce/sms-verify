const twilio = require("twilio");
const logger = require("../utils/logger");

class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      logger.warn("Twilio credentials not fully configured. SMS verification will not work.");
      this.client = null;
    } else {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  /**
   * 发送SMS验证码
   * @param {string} to - 目标手机号码（包含国家代码，如 +8613800138000）
   * @param {string} code - 验证码
   * @param {string} userId - 用户ID（用于日志记录）
   * @returns {Promise<Object>} 发送结果
   */
  async sendVerificationCode(to, code, userId) {
    try {
      if (!this.client) {
        throw new Error("Twilio client not initialized. Please check your credentials.");
      }

      // 验证手机号格式
      if (!to || !to.startsWith("+")) {
        throw new Error(
          "Invalid phone number format. Must include country code (e.g., +8613800138000)"
        );
      }

      // 验证验证码格式
      if (!code || code.length !== 8) {
        throw new Error("Invalid verification code format. Must be 8 digits.");
      }

      logger.info("Sending SMS verification code", {
        to: this.maskPhoneNumber(to),
        userId,
        codeLength: code.length,
      });

      // 发送SMS
      const message = await this.client.messages.create({
        body: `您的验证码是: ${code}。请在10分钟内完成验证。`,
        from: this.phoneNumber,
        to: to,
      });

      logger.info("SMS verification code sent successfully", {
        messageId: message.sid,
        to: this.maskPhoneNumber(to),
        userId,
        status: message.status,
      });

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: this.maskPhoneNumber(to),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to send SMS verification code", {
        error: error.message,
        to: this.maskPhoneNumber(to),
        userId,
        code: code ? `${code.substring(0, 2)}****${code.substring(6)}` : "N/A",
      });

      // 处理Twilio特定错误
      if (error.code) {
        switch (error.code) {
          case 21211:
            throw new Error("无效的手机号码格式");
          case 21214:
            throw new Error("手机号码格式不正确，请包含国家代码");
          case 21608:
            throw new Error("消息内容为空");
          case 21610:
            throw new Error("消息内容过长");
          case 21612:
            throw new Error("无效的发送者号码");
          case 21614:
            throw new Error("发送者号码未验证");
          case 30000:
            throw new Error("网络连接错误");
          case 30001:
            throw new Error("Twilio服务暂时不可用");
          case 30002:
            throw new Error("请求超时");
          case 30003:
            throw new Error("API请求限制");
          case 30004:
            throw new Error("账户余额不足");
          case 30005:
            throw new Error("账户已暂停");
          case 30006:
            throw new Error("账户已关闭");
          case 30007:
            throw new Error("账户未激活");
          case 30008:
            throw new Error("账户需要验证");
          case 30009:
            throw new Error("账户需要升级");
          case 30010:
            throw new Error("账户需要重新激活");
          default:
            throw new Error(`SMS发送失败: ${error.message}`);
        }
      }

      throw new Error(`SMS发送失败: ${error.message}`);
    }
  }

  /**
   * 发送自定义SMS消息
   * @param {string} to - 目标手机号码
   * @param {string} message - 消息内容
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 发送结果
   */
  async sendCustomMessage(to, message, userId) {
    try {
      if (!this.client) {
        throw new Error("Twilio client not initialized. Please check your credentials.");
      }

      if (!to || !to.startsWith("+")) {
        throw new Error("Invalid phone number format. Must include country code.");
      }

      if (!message || message.trim().length === 0) {
        throw new Error("Message content cannot be empty.");
      }

      logger.info("Sending custom SMS message", {
        to: this.maskPhoneNumber(to),
        userId,
        messageLength: message.length,
      });

      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to,
      });

      logger.info("Custom SMS message sent successfully", {
        messageId: result.sid,
        to: this.maskPhoneNumber(to),
        userId,
        status: result.status,
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: this.maskPhoneNumber(to),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to send custom SMS message", {
        error: error.message,
        to: this.maskPhoneNumber(to),
        userId,
      });
      throw error;
    }
  }

  /**
   * 验证手机号格式
   * @param {string} phoneNumber - 手机号码
   * @returns {boolean} 是否有效
   */
  isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return false;
    }

    // 基本格式验证：+国家代码 手机号
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * 格式化手机号（添加+号如果没有）
   * @param {string} phoneNumber - 手机号码
   * @returns {string} 格式化后的手机号
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return phoneNumber;
    }

    // 如果已经有+号，直接返回
    if (phoneNumber.startsWith("+")) {
      return phoneNumber;
    }

    // 如果没有+号，添加
    return `+${phoneNumber}`;
  }

  /**
   * 掩码手机号（保护隐私）
   * @param {string} phoneNumber - 手机号码
   * @returns {string} 掩码后的手机号
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 7) {
      return phoneNumber;
    }

    // 保留国家代码和最后4位，中间用*替换
    const countryCode = phoneNumber.substring(0, phoneNumber.length - 7);
    const lastFour = phoneNumber.substring(phoneNumber.length - 4);
    const masked = "*".repeat(3);

    return `${countryCode}${masked}${lastFour}`;
  }

  /**
   * 测试Twilio连接
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection() {
    try {
      if (!this.client) {
        return {
          success: false,
          error: "Twilio client not initialized",
          details:
            "Please check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables",
        };
      }

      // 尝试获取账户信息来测试连接
      const account = await this.client.api.accounts(this.accountSid).fetch();

      return {
        success: true,
        accountSid: account.sid,
        accountName: account.friendlyName,
        status: account.status,
        type: account.type,
        dateCreated: account.dateCreated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Twilio connection test failed", { error: error.message });

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 获取账户余额信息
   * @returns {Promise<Object>} 余额信息
   */
  async getBalance() {
    try {
      if (!this.client) {
        throw new Error("Twilio client not initialized");
      }

      const account = await this.client.api.accounts(this.accountSid).fetch();

      return {
        success: true,
        balance: account.balance,
        currency: account.currency,
        status: account.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get Twilio account balance", { error: error.message });
      throw error;
    }
  }

  /**
   * 获取发送历史
   * @param {number} limit - 限制数量（默认50）
   * @returns {Promise<Object>} 发送历史
   */
  async getMessageHistory(limit = 50) {
    try {
      if (!this.client) {
        throw new Error("Twilio client not initialized");
      }

      const messages = await this.client.messages.list({ limit });

      return {
        success: true,
        messages: messages.map((msg) => ({
          id: msg.sid,
          to: this.maskPhoneNumber(msg.to),
          from: msg.from,
          body: msg.body,
          status: msg.status,
          direction: msg.direction,
          dateCreated: msg.dateCreated,
          dateSent: msg.dateSent,
        })),
        count: messages.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get message history", { error: error.message });
      throw error;
    }
  }

  /**
   * 获取服务健康状态
   * @returns {Promise<Object>} 健康状态
   */
  async getHealthStatus() {
    try {
      const startTime = Date.now();

      // 测试基本连接
      const connectionTest = await this.testConnection();
      const responseTime = Date.now() - startTime;

      const healthData = {
        status: connectionTest.success ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        accountSid: this.accountSid,
        phoneNumber: this.phoneNumber,
        credentialsConfigured: !!(this.accountSid && this.authToken && this.phoneNumber),
        ...connectionTest,
      };

      if (connectionTest.success) {
        try {
          const balance = await this.getBalance();
          healthData.balance = balance;
        } catch (error) {
          healthData.balanceError = error.message;
        }
      }

      return healthData;
    } catch (error) {
      logger.error("Failed to get health status", { error: error.message });

      return {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error.message,
        accountSid: this.accountSid,
        phoneNumber: this.phoneNumber,
        credentialsConfigured: !!(this.accountSid && this.authToken && this.phoneNumber),
      };
    }
  }
}

module.exports = TwilioService;
