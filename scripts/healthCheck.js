#!/usr/bin/env node

const axios = require("axios");
const { performance } = require("perf_hooks");

require("dotenv").config();

/**
 * 健康检查脚本
 * 用于验证系统各组件的健康状态
 */

const config = {
  baseURL: process.env.APP_URL || "http://localhost:3001",
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

class HealthChecker {
  constructor() {
    this.results = {
      overall: "unknown",
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };
  }

  /**
   * 执行单个健康检查
   */
  async runCheck(name, checkFunction) {
    console.log(`🔍 检查 ${name}...`);
    const startTime = performance.now();

    try {
      const result = await this.retryOperation(checkFunction, config.retryAttempts);
      const duration = Math.round(performance.now() - startTime);

      this.results.checks[name] = {
        status: "passed",
        duration: `${duration}ms`,
        message: result.message || "检查通过",
        details: result.details || {},
        timestamp: new Date().toISOString(),
      };

      this.results.summary.passed++;
      console.log(`✅ ${name} - 通过 (${duration}ms)`);
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      this.results.checks[name] = {
        status: "failed",
        duration: `${duration}ms`,
        message: error.message || "检查失败",
        error: error.name || "UnknownError",
        timestamp: new Date().toISOString(),
      };

      this.results.summary.failed++;
      console.log(`❌ ${name} - 失败: ${error.message}`);
    }

    this.results.summary.total++;
  }

  /**
   * 重试机制
   */
  async retryOperation(operation, maxAttempts) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          console.log(`⚠️ 第 ${attempt} 次尝试失败，${config.retryDelay}ms 后重试...`);
          await this.sleep(config.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 检查服务器基本连接
   */
  async checkServerConnection() {
    try {
      const response = await axios.get(`${config.baseURL}/api/health`, {
        timeout: config.timeout,
      });

      if (response.status === 200) {
        return {
          message: "服务器连接正常",
          details: {
            status: response.status,
            responseTime: response.headers["x-response-time"],
          },
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        throw new Error("服务器连接被拒绝，请检查服务是否启动");
      }
      if (error.code === "ETIMEDOUT") {
        throw new Error("服务器连接超时");
      }
      throw new Error(`连接失败: ${error.message}`);
    }
  }

  /**
   * 检查数据库连接
   */
  async checkDatabase() {
    try {
      const response = await axios.get(`${config.baseURL}/api/health/database`, {
        timeout: config.timeout,
        headers: {
          Authorization: `Bearer ${process.env.HEALTH_CHECK_TOKEN || ""}`,
        },
      });

      if (response.data.success) {
        return {
          message: "数据库连接正常",
          details: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "数据库健康检查失败");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error("数据库健康检查需要认证");
      }
      throw new Error(`数据库检查失败: ${error.message}`);
    }
  }

  /**
   * 检查SMS-Activate API
   */
  async checkSMSActivateAPI() {
    try {
      const response = await axios.get(`${config.baseURL}/api/health/sms-activate`, {
        timeout: config.timeout,
        headers: {
          Authorization: `Bearer ${process.env.HEALTH_CHECK_TOKEN || ""}`,
        },
      });

      if (response.data.success) {
        return {
          message: "SMS-Activate API连接正常",
          details: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "SMS-Activate API检查失败");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error("SMS-Activate API检查需要认证");
      }
      throw new Error(`SMS-Activate API检查失败: ${error.message}`);
    }
  }

  /**
   * 检查邮件服务
   */
  async checkEmailService() {
    try {
      const response = await axios.get(`${config.baseURL}/api/health/email`, {
        timeout: config.timeout,
        headers: {
          Authorization: `Bearer ${process.env.HEALTH_CHECK_TOKEN || ""}`,
        },
      });

      if (response.data.success) {
        return {
          message: "邮件服务正常",
          details: response.data.data,
        };
      } else {
        throw new Error(response.data.message || "邮件服务检查失败");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error("邮件服务检查需要认证");
      }
      throw new Error(`邮件服务检查失败: ${error.message}`);
    }
  }

  /**
   * 检查Webhook服务
   */
  async checkWebhookService() {
    try {
      const response = await axios.get(`${config.baseURL}/api/webhook/health`, {
        timeout: config.timeout,
      });

      if (response.data.success) {
        return {
          message: "Webhook服务正常",
          details: response.data,
        };
      } else {
        throw new Error("Webhook服务检查失败");
      }
    } catch (error) {
      throw new Error(`Webhook服务检查失败: ${error.message}`);
    }
  }

  /**
   * 执行所有健康检查
   */
  async runAllChecks() {
    console.log("🏥 开始系统健康检查...");
    console.log(`🌐 目标URL: ${config.baseURL}`);
    console.log("=" * 50);

    const checks = [
      ["服务器连接", () => this.checkServerConnection()],
      ["数据库", () => this.checkDatabase()],
      ["SMS-Activate API", () => this.checkSMSActivateAPI()],
      ["邮件服务", () => this.checkEmailService()],
      ["Webhook服务", () => this.checkWebhookService()],
    ];

    for (const [name, checkFn] of checks) {
      await this.runCheck(name, checkFn);
    }

    // 计算总体状态
    if (this.results.summary.failed === 0) {
      this.results.overall = "healthy";
    } else if (this.results.summary.passed > this.results.summary.failed) {
      this.results.overall = "degraded";
    } else {
      this.results.overall = "unhealthy";
    }

    return this.results;
  }

  /**
   * 打印结果摘要
   */
  printSummary() {
    console.log("\n" + "=" * 50);
    console.log("📊 健康检查摘要");
    console.log("=" * 50);

    const { summary, overall } = this.results;
    const statusEmoji = {
      healthy: "🟢",
      degraded: "🟡",
      unhealthy: "🔴",
    };

    console.log(`总体状态: ${statusEmoji[overall]} ${overall.toUpperCase()}`);
    console.log(`总检查项: ${summary.total}`);
    console.log(`✅ 通过: ${summary.passed}`);
    console.log(`❌ 失败: ${summary.failed}`);
    console.log(`⚠️ 警告: ${summary.warnings}`);

    if (summary.failed > 0) {
      console.log("\n❌ 失败的检查项:");
      Object.entries(this.results.checks)
        .filter(([_, check]) => check.status === "failed")
        .forEach(([name, check]) => {
          console.log(`  • ${name}: ${check.message}`);
        });
    }

    return overall === "healthy" ? 0 : 1;
  }

  /**
   * 输出JSON格式结果
   */
  outputJSON() {
    console.log(JSON.stringify(this.results, null, 2));
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const isJSONOutput = args.includes("--json");
  const isQuiet = args.includes("--quiet");

  const checker = new HealthChecker();

  try {
    const results = await checker.runAllChecks();

    if (isJSONOutput) {
      checker.outputJSON();
      process.exit(0);
    }

    if (!isQuiet) {
      const exitCode = checker.printSummary();
      process.exit(exitCode);
    }
  } catch (error) {
    if (isJSONOutput) {
      console.log(
        JSON.stringify({
          overall: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      console.error(`❌ 健康检查失败: ${error.message}`);
    }
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 未捕获的错误:", error);
    process.exit(1);
  });
}

module.exports = { HealthChecker };
