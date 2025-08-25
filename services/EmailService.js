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
    // 生产环境或明确指定SMTP时使用SMTP配置
    const email_provider = process.env.EMAIL_PROVIDER || "hostinger";

    // 尝试不同的SMTP配置
    const smtpConfigs = [
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: true, // SSL
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: "SSLv3",
        },
      },
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: "TLSv1.2",
        },
      },
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: 25,
        secure: false, // No encryption
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      },
    ];

    // 返回第一个配置，如果失败会自动尝试下一个
    return nodemailer.createTransport(smtpConfigs[0]);
  }

  /**
   * 测试SMTP连接
   */
  async testConnection() {
    const smtpConfigs = [
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: true, // SSL
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: "SSLv3",
        },
      },
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: "TLSv1.2",
        },
      },
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: 25,
        secure: false, // No encryption
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      },
    ];

    for (let i = 0; i < smtpConfigs.length; i++) {
      try {
        const config = smtpConfigs[i];
        logger.info(
          `测试SMTP配置 ${i + 1}: ${config.host}:${config.port} (secure: ${config.secure})`
        );

        const transporter = nodemailer.createTransport(config);
        await transporter.verify();

        logger.info(`SMTP配置 ${i + 1} 连接成功: ${config.host}:${config.port}`);
        return {
          success: true,
          message: `SMTP连接成功: ${config.host}:${config.port}`,
          config: config,
        };
      } catch (error) {
        logger.warn(`SMTP配置 ${i + 1} 连接失败: ${config.host}:${config.port} - ${error.message}`);

        if (i === smtpConfigs.length - 1) {
          // 所有配置都失败了
          logger.error("所有SMTP配置都失败了");
          return {
            success: false,
            error: error.message,
            details: "请检查SMTP配置，确保主机、端口、用户名和密码正确",
          };
        }
      }
    }
  }

  /**
   * 发送邮件
   */
  async sendMail(to, subject, html, text = null) {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
      text: text || this.stripHtml(html),
    };

    // 尝试不同的SMTP配置
    const smtpConfigs = [
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: true, // SSL
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: "SSLv3",
        },
      },
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
          ciphers: "TLSv1.2",
        },
      },
      {
        host: process.env.SMTP_HOST || "smtp.hostinger.com",
        port: 25,
        secure: false, // No encryption
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
      },
    ];

    let lastError = null;

    for (let i = 0; i < smtpConfigs.length; i++) {
      try {
        const config = smtpConfigs[i];
        logger.info(
          `尝试SMTP配置 ${i + 1}: ${config.host}:${config.port} (secure: ${config.secure})`
        );

        const transporter = nodemailer.createTransport(config);
        const result = await transporter.sendMail(mailOptions);

        logger.info("邮件发送成功:", {
          to,
          subject,
          messageId: result.messageId,
          config: `${config.host}:${config.port}`,
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
        lastError = error;
        logger.warn(`SMTP配置 ${i + 1} 失败: ${config.host}:${config.port} - ${error.message}`);

        if (i === smtpConfigs.length - 1) {
          // 最后一个配置也失败了，尝试使用Ethereal作为后备
          logger.warn("所有SMTP配置都失败了，尝试使用Ethereal作为后备");

          try {
            const etherealTransporter = nodemailer.createTransport({
              host: "smtp.ethereal.email",
              port: 587,
              secure: false,
              auth: {
                user: process.env.ETHEREAL_USER || "test@ethereal.email",
                pass: process.env.ETHEREAL_PASS || "test123",
              },
            });

            const result = await etherealTransporter.sendMail(mailOptions);

            logger.info("邮件通过Ethereal发送成功:", {
              to,
              subject,
              messageId: result.messageId,
              previewUrl: result.messageUrl,
            });

            return {
              success: true,
              messageId: result.messageId,
              previewUrl: result.messageUrl,
              fallback: "ethereal",
            };
          } catch (etherealError) {
            logger.error("Ethereal也失败了:", etherealError);
            throw lastError; // 抛出原始错误
          }
        }
      }
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
  async sendEmailVerification(email, username, verificationCode) {
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
          .verification-code {
            background: #f0f8ff;
            border: 2px solid #1890ff;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
          }
          .verification-code .code {
            font-size: 32px;
            font-weight: bold;
            color: #1890ff;
            letter-spacing: 4px;
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
          .warning {
            background: #fff7e6;
            border: 1px solid #ffd591;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #ad6800;
          }
          .instructions {
            background: #f6ffed;
            border: 1px solid #b7eb8f;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            color: #389e0d;
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
            <p>感谢您注册SMS验证平台。为了确保您的账户安全，请使用以下验证码完成邮箱验证。</p>
            
            <div class="verification-code">
              <div>您的验证码是：</div>
              <div class="code">${verificationCode}</div>
              <div style="font-size: 14px; color: #666;">请在10分钟内完成验证</div>
            </div>
            
            <div class="instructions">
              <strong>验证步骤：</strong>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>复制上面的8位验证码</li>
                <li>返回SMS验证平台</li>
                <li>在验证页面输入验证码</li>
                <li>点击"验证邮箱"按钮</li>
              </ol>
            </div>
            
            <div class="warning">
              <strong>安全提醒：</strong>
              <ul style="margin: 10px 0;">
                <li>此验证码将在10分钟后过期</li>
                <li>请勿将验证码分享给他人</li>
                <li>如果这不是您本人的操作，请忽略此邮件</li>
                <li>验证成功后即可正常使用平台所有功能</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>© 2025 SMS验证平台. 保留所有权利。</p>
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
            <p>© 2025 SMS验证平台. 保留所有权利。</p>
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
            <p>© 2025 SMS验证平台. 保留所有权利。</p>
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
            <p>© 2025 SMS验证平台. 保留所有权利。</p>
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
}

module.exports = EmailService;
