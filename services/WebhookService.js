const crypto = require("crypto");
const { Rental, Transaction, User } = require("../models");
const logger = require("../utils/logger");
const { Op } = require("sequelize");

class WebhookService {
  constructor() {
    this.webhookSecret = process.env.WEBHOOK_SECRET || "default-webhook-secret";
  }

  /**
   * 验证webhook签名
   */
  verifySignature(payload, signature, secret = null) {
    const webhookSecret = secret || this.webhookSecret;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    // 支持多种签名格式
    const receivedSignature = signature.replace(/^(sha256=|sha1=)/, "");

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  }

  /**
   * 处理租用状态更新webhook
   */
  async handleRentalWebhook(payload) {
    try {
      logger.info("处理租用webhook:", payload);

      const {
        id: externalId,
        phone,
        status,
        endDate,
        messages = [],
        action,
      } = payload;

      if (!externalId) {
        throw new Error("缺少租用ID");
      }

      // 查找对应的租用记录
      const rental = await Rental.findOne({
        where: { external_id: externalId.toString() },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email"],
          },
        ],
      });

      if (!rental) {
        logger.warn(`未找到租用记录: ${externalId}`);
        return { success: false, message: "租用记录不存在" };
      }

      // 更新租用状态
      const updates = {};

      if (status) {
        // 映射SMS-Activate状态到我们的状态
        const statusMap = {
          STATUS_WAIT_CODE: "active",
          STATUS_OK: "active",
          STATUS_FINISH: "completed",
          STATUS_CANCEL: "cancelled",
          STATUS_REVOKE: "cancelled",
        };

        const mappedStatus = statusMap[status] || rental.status;
        if (mappedStatus !== rental.status) {
          updates.status = mappedStatus;
          logger.info(
            `租用 ${rental.id} 状态更新: ${rental.status} -> ${mappedStatus}`
          );
        }
      }

      if (endDate) {
        updates.end_time = new Date(endDate);
      }

      if (messages && messages.length > 0) {
        // 更新短信记录
        updates.messages = JSON.stringify(messages);
        logger.info(`租用 ${rental.id} 收到 ${messages.length} 条短信`);
      }

      // 执行更新
      if (Object.keys(updates).length > 0) {
        await rental.update(updates);

        // 记录活动日志
        if (rental.user) {
          await this.logUserActivity(
            rental.user.id,
            "rental_webhook_update",
            `租用 ${rental.phone_number} 状态更新`,
            { rental_id: rental.id, updates }
          );
        }
      }

      return {
        success: true,
        message: "Webhook处理成功",
        rental_id: rental.id,
        updates,
      };
    } catch (error) {
      logger.error("处理租用webhook失败:", error);
      throw error;
    }
  }

  /**
   * 处理支付webhook
   */
  async handlePaymentWebhook(payload) {
    try {
      logger.info("处理支付webhook:", payload);

      const {
        order_id: orderId,
        status,
        amount,
        currency = "USD",
        transaction_id: externalTransactionId,
        payment_method,
        timestamp,
      } = payload;

      if (!orderId) {
        throw new Error("缺少订单ID");
      }

      // 查找对应的交易记录
      const transaction = await Transaction.findOne({
        where: {
          external_id: orderId,
          type: "recharge",
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email", "balance"],
          },
        ],
      });

      if (!transaction) {
        logger.warn(`未找到支付订单: ${orderId}`);
        return { success: false, message: "支付订单不存在" };
      }

      // 检查是否已经处理过
      if (transaction.status === "completed") {
        logger.info(`支付订单 ${orderId} 已经处理过`);
        return { success: true, message: "订单已处理" };
      }

      const updates = {};

      if (status === "success" || status === "completed") {
        // 支付成功
        updates.status = "completed";
        updates.processed_at = new Date();

        if (externalTransactionId) {
          updates.reference = externalTransactionId;
        }

        // 更新用户余额
        const user = transaction.user;
        const rechargeAmount = parseFloat(amount || transaction.amount);

        await user.update({
          balance: parseFloat(user.balance) + rechargeAmount,
          total_recharged:
            parseFloat(user.total_recharged || 0) + rechargeAmount,
        });

        logger.info(
          `用户 ${user.id} 充值成功: $${rechargeAmount}, 新余额: $${
            user.balance + rechargeAmount
          }`
        );

        // 记录活动日志
        await this.logUserActivity(
          user.id,
          "payment_success",
          `充值成功 $${rechargeAmount}`,
          {
            transaction_id: transaction.id,
            amount: rechargeAmount,
            payment_method,
            external_transaction_id: externalTransactionId,
          }
        );
      } else if (status === "failed" || status === "cancelled") {
        // 支付失败或取消
        updates.status = status === "failed" ? "failed" : "cancelled";
        updates.processed_at = new Date();

        if (transaction.user) {
          await this.logUserActivity(
            transaction.user.id,
            "payment_failed",
            `充值${status === "failed" ? "失败" : "取消"} $${
              transaction.amount
            }`,
            {
              transaction_id: transaction.id,
              reason: status,
              payment_method,
            }
          );
        }
      }

      // 执行更新
      if (Object.keys(updates).length > 0) {
        await transaction.update(updates);
      }

      return {
        success: true,
        message: "支付webhook处理成功",
        transaction_id: transaction.id,
        status: updates.status || transaction.status,
      };
    } catch (error) {
      logger.error("处理支付webhook失败:", error);
      throw error;
    }
  }

  /**
   * 处理激活状态更新webhook
   */
  async handleActivationWebhook(payload) {
    try {
      logger.info("处理激活webhook:", payload);

      const { id: externalId, phone, status, sms, service, country } = payload;

      if (!externalId) {
        throw new Error("缺少激活ID");
      }

      // 查找对应的激活记录
      const { Activation } = require("../models");
      const activation = await Activation.findOne({
        where: { external_id: externalId.toString() },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email"],
          },
        ],
      });

      if (!activation) {
        logger.warn(`未找到激活记录: ${externalId}`);
        return { success: false, message: "激活记录不存在" };
      }

      const updates = {};

      // 更新状态
      if (status) {
        const statusMap = {
          STATUS_WAIT_CODE: "pending",
          STATUS_OK: "completed",
          STATUS_CANCEL: "cancelled",
          STATUS_WAIT_RETRY: "pending",
        };

        const mappedStatus = statusMap[status] || activation.status;
        if (mappedStatus !== activation.status) {
          updates.status = mappedStatus;

          if (mappedStatus === "completed") {
            updates.completed_at = new Date();
          }
        }
      }

      // 更新短信内容
      if (sms) {
        updates.sms_code = sms;
        updates.received_at = new Date();
      }

      // 执行更新
      if (Object.keys(updates).length > 0) {
        await activation.update(updates);

        // 记录活动日志
        if (activation.user) {
          await this.logUserActivity(
            activation.user.id,
            "activation_webhook_update",
            `激活 ${activation.phone_number} 状态更新`,
            { activation_id: activation.id, updates }
          );
        }
      }

      return {
        success: true,
        message: "激活webhook处理成功",
        activation_id: activation.id,
        updates,
      };
    } catch (error) {
      logger.error("处理激活webhook失败:", error);
      throw error;
    }
  }

  /**
   * 记录用户活动日志
   */
  async logUserActivity(userId, action, description, metadata = {}) {
    try {
      const { UserActivityLog } = require("../models");
      await UserActivityLog.create({
        user_id: userId,
        action,
        description,
        metadata: JSON.stringify(metadata),
        ip_address: metadata.ip_address || "webhook",
        user_agent: "WebhookService",
      });
    } catch (error) {
      logger.error("记录用户活动失败:", error);
    }
  }

  /**
   * 生成webhook URL
   */
  generateWebhookUrl(type, secret = null) {
    const baseUrl = process.env.APP_URL || "https://smsyz.online";
    const webhookSecret = secret || crypto.randomBytes(16).toString("hex");

    return {
      url: `${baseUrl}/api/webhook/${type}?secret=${webhookSecret}`,
      secret: webhookSecret,
    };
  }

  /**
   * 测试webhook连接
   */
  async testWebhook(url, payload, secret) {
    try {
      const signature = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(payload))
        .digest("hex");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
        },
        body: JSON.stringify(payload),
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      logger.error("测试webhook失败:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = WebhookService;
