const nodemailer = require("nodemailer");
const logger = require("../utils/logger");
const crypto = require("crypto");

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
    this.fromEmail = process.env.EMAIL_FROM || "noreply@smsyz.online";
    this.fromName = process.env.EMAIL_FROM_NAME || "SMS验证平台";
  }

  /**
   * 创建邮件传输器
   */
  createTransporter() {
    if (process.env.NODE_ENV === "development") {
      // 开发环境使用Ethereal测试邮箱
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER || "test@ethereal.email",
          pass: process.env.ETHEREAL_PASS || "test123",
        },
      });
    } else {
      // 生产环境配置，支持多种邮件服务
      const emailProvider = process.env.EMAIL_PROVIDER || "smtp";

      switch (emailProvider) {
        case "gmail":
          return nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_APP_PASSWORD,
            },
          });

        case "sendgrid":
          return nodemailer.createTransport({
            host: "smtp.sendgrid.net",
            port: 587,
            secure: false,
            auth: {
              user: "apikey",
              pass: process.env.SENDGRID_API_KEY,
            },
          });

        case "mailgun":
          return nodemailer.createTransport({
            host: "smtp.mailgun.org",
            port: 587,
            secure: false,
            auth: {
              user: process.env.MAILGUN_USERNAME,
              pass: process.env.MAILGUN_PASSWORD,
            },
          });

        case "smtp":
        default:
          return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });
      }
    }
  }

  /**
   * 发送邮件
   */
  async sendMail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info("邮件发送成功:", {
        to,
        subject,
        messageId: result.messageId,
      });

      // 开发环境显示预览链接
      if (process.env.NODE_ENV === "development" && result.messageUrl) {
        logger.info("邮件预览链接:", result.messageUrl);
      }

      return {
        success: true,
        messageId: result.messageId,
        previewUrl: result.messageUrl,
      };
    } catch (error) {
      logger.error("邮件发送失败:", error);
      throw error;
    }
  }

  /**
   * 生成验证Token
   */
  generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * 发送邮箱验证邮件
   */
  async sendEmailVerification(email, username, token) {
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/verify-email?token=${token}`;

    const subject = "验证您的邮箱地址 - SMS验证平台";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>邮箱验证</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #1890ff;
            margin: 0;
            font-size: 28px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background: #1890ff;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            text-align: center;
            margin: 20px 0;
          }
          .button:hover {
            background: #40a9ff;
          }
          .footer {
            text-align: center;
            font-size: 14px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
          }
          .warning {
            background: #fff7e6;
            border: 1px solid #ffd591;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #ad6800;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>SMS验证平台</h1>
          </div>
          
          <div class="content">
            <h2>欢迎 ${username}！</h2>
            <p>感谢您注册SMS验证平台。为了确保您的账户安全，请点击下面的按钮验证您的邮箱地址。</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">验证邮箱地址</a>
            </div>
            
            <p>如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <div class="warning">
              <strong>注意：</strong>
              <ul style="margin: 10px 0;">
                <li>此验证链接将在24小时后过期</li>
                <li>如果这不是您本人的操作，请忽略此邮件</li>
                <li>验证成功后即可正常使用平台所有功能</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>© 2024 SMS验证平台. 保留所有权利。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail(email, subject, html);
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordReset(email, username, token) {
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password?token=${token}`;

    const subject = "重置您的密码 - SMS验证平台";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>密码重置</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #1890ff;
            margin: 0;
            font-size: 28px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background: #ff4d4f;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            text-align: center;
            margin: 20px 0;
          }
          .button:hover {
            background: #ff7875;
          }
          .footer {
            text-align: center;
            font-size: 14px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
          }
          .warning {
            background: #fff2f0;
            border: 1px solid #ffccc7;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #a8071a;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>SMS验证平台</h1>
          </div>
          
          <div class="content">
            <h2>密码重置请求</h2>
            <p>您好 ${username}，</p>
            <p>我们收到了重置您账户密码的请求。如果这是您本人的操作，请点击下面的按钮重置密码。</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">重置密码</a>
            </div>
            
            <p>如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <strong>安全提醒：</strong>
              <ul style="margin: 10px 0;">
                <li>此重置链接将在1小时后过期</li>
                <li>如果这不是您本人的操作，请立即联系客服</li>
                <li>为了账户安全，建议设置强密码</li>
                <li>请勿将此链接分享给他人</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>© 2024 SMS验证平台. 保留所有权利。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail(email, subject, html);
  }

  /**
   * 发送登录通知邮件
   */
  async sendLoginNotification(email, username, loginInfo) {
    const { ip, userAgent, location, time } = loginInfo;

    const subject = "登录通知 - SMS验证平台";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>登录通知</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #1890ff;
            margin: 0;
            font-size: 28px;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .info-table td {
            padding: 10px;
            border-bottom: 1px solid #eee;
          }
          .info-table td:first-child {
            font-weight: 500;
            color: #666;
            width: 120px;
          }
          .footer {
            text-align: center;
            font-size: 14px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
          }
          .warning {
            background: #fff7e6;
            border: 1px solid #ffd591;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #ad6800;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>SMS验证平台</h1>
          </div>
          
          <div class="content">
            <h2>登录通知</h2>
            <p>您好 ${username}，</p>
            <p>您的账户刚刚登录成功，以下是本次登录的详细信息：</p>
            
            <table class="info-table">
              <tr>
                <td>登录时间:</td>
                <td>${time}</td>
              </tr>
              <tr>
                <td>IP地址:</td>
                <td>${ip}</td>
              </tr>
              <tr>
                <td>设备信息:</td>
                <td>${userAgent}</td>
              </tr>
              ${location ? `<tr><td>登录位置:</td><td>${location}</td></tr>` : ""}
            </table>
            
            <div class="warning">
              <strong>安全提醒：</strong>
              <p>如果这不是您本人的登录行为，请立即：</p>
              <ul style="margin: 10px 0;">
                <li>修改您的账户密码</li>
                <li>检查账户安全设置</li>
                <li>联系客服进行安全检查</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>© 2024 SMS验证平台. 保留所有权利。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail(email, subject, html);
  }

  /**
   * 发送充值成功通知
   */
  async sendRechargeNotification(email, username, amount, balance) {
    const subject = "充值成功通知 - SMS验证平台";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>充值成功</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .logo {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo h1 {
            color: #1890ff;
            margin: 0;
            font-size: 28px;
          }
          .amount {
            background: #f6ffed;
            border: 1px solid #b7eb8f;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .amount .value {
            font-size: 32px;
            font-weight: bold;
            color: #52c41a;
            margin: 10px 0;
          }
          .footer {
            text-align: center;
            font-size: 14px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>SMS验证平台</h1>
          </div>
          
          <div class="content">
            <h2>充值成功！</h2>
            <p>您好 ${username}，</p>
            <p>您的账户充值已成功处理。</p>
            
            <div class="amount">
              <div>本次充值金额</div>
              <div class="value">$${amount.toFixed(2)}</div>
              <div>账户余额：$${balance.toFixed(2)}</div>
            </div>
            
            <p>充值时间：${new Date().toLocaleString("zh-CN")}</p>
            <p>您现在可以开始使用平台的各项服务了！</p>
          </div>
          
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>© 2024 SMS验证平台. 保留所有权利。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail(email, subject, html);
  }

  /**
   * 去除HTML标签（用于纯文本版本）
   */
  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * 测试邮件服务连接
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      logger.info("邮件服务连接测试成功");
      return { success: true, message: "邮件服务连接正常" };
    } catch (error) {
      logger.error("邮件服务连接测试失败:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;
