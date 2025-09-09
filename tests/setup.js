const { Sequelize } = require("sequelize");

// 设置测试环境变量
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.DB_NAME = "sms_verify_test";
process.env.DB_USER = "test_user";
process.env.DB_PASSWORD = "test_password";
process.env.DB_HOST = "localhost";
process.env.SMS_ACTIVATE_API_KEY = "test-api-key";
process.env.EMAIL_PROVIDER = "ethereal";
process.env.WEBHOOK_SECRET = "test-webhook-secret";

// 全局测试设置
beforeAll(async () => {
  // 初始化测试数据库连接
  const db = require("../config/database");

  try {
    await db.authenticate();
    console.log("✅ 测试数据库连接成功");

    // Database sync removed as requested
    console.log("✅ 测试数据库表同步已禁用");
  } catch (error) {
    console.error("❌ 测试数据库设置失败:", error);
    process.exit(1);
  }
});

// 每个测试后清理
afterEach(async () => {
  // 清理测试数据
  const { User, Activation, Rental, Transaction, ApiKey } = require("../models");

  try {
    await Promise.all([
      Transaction.destroy({ where: {}, force: true }),
      Rental.destroy({ where: {}, force: true }),
      Activation.destroy({ where: {}, force: true }),
      ApiKey.destroy({ where: {}, force: true }),
      User.destroy({ where: {}, force: true }),
    ]);
  } catch (error) {
    console.error("清理测试数据失败:", error);
  }
});

// 全局测试清理
afterAll(async () => {
  const db = require("../config/database");

  try {
    await db.close();
    console.log("✅ 测试数据库连接已关闭");
  } catch (error) {
    console.error("❌ 关闭测试数据库连接失败:", error);
  }
});

// 全局测试工具函数
global.testHelpers = {
  // 创建测试用户
  createTestUser: async (userData = {}) => {
    const { User } = require("../models");
    const bcrypt = require("bcryptjs");

    const defaultUser = {
      username: "testuser",
      email: "test@example.com",
      password_hash: await bcrypt.hash("password123", 10),
      status: "active",
      balance: 100.0,
      total_spent: 0.0,
      total_recharged: 100.0,
      email_verified: true,
    };

    return User.create({ ...defaultUser, ...userData });
  },

  // 创建JWT令牌
  createTestToken: (userId, role = "user") => {
    const jwt = require("jsonwebtoken");
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
  },

  // 创建测试激活记录
  createTestActivation: async (userId, activationData = {}) => {
    const { Activation } = require("../models");

    const defaultActivation = {
      user_id: userId,
      activation_id: "12345",
      service: "telegram",
      country_id: 0,
      phone_number: "79181234567",
      cost: 0.5,
      status: "pending",
      expires_at: new Date(Date.now() + 20 * 60 * 1000),
      check_count: 0,
    };

    return Activation.create({ ...defaultActivation, ...activationData });
  },

  // 创建测试租用记录
  createTestRental: async (userId, rentalData = {}) => {
    const { Rental } = require("../models");

    const defaultRental = {
      user_id: userId,
      external_id: "rent_12345",
      phone_number: "79181234567",
      service: "telegram",
      country_id: 0,
      operator: "any",
      time_hours: 4,
      price: 0.2,
      original_price: 0.18,
      status: "active",
      start_time: new Date(),
      end_time: new Date(Date.now() + 4 * 60 * 60 * 1000),
      incoming_call: false,
    };

    return Rental.create({ ...defaultRental, ...rentalData });
  },

  // 创建测试交易记录
  createTestTransaction: async (userId, transactionData = {}) => {
    const { Transaction } = require("../models");

    const defaultTransaction = {
      user_id: userId,
      type: "recharge",
      amount: 10.0,
      description: "测试充值",
      status: "completed",
      reference_type: "test",
    };

    return Transaction.create({ ...defaultTransaction, ...transactionData });
  },

  // 模拟SMS-Activate API响应
  mockSMSActivateResponse: (success = true, data = {}) => {
    if (success) {
      return {
        success: true,
        ...data,
      };
    } else {
      return {
        success: false,
        message: "API调用失败",
        ...data,
      };
    }
  },

  // 等待异步操作
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// 模拟外部服务
jest.mock("axios", () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  request: jest.fn(),
}));

// 模拟邮件服务
jest.mock("nodemailer", () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({
      messageId: "test-message-id",
      response: "250 Message accepted",
    }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

console.log("🧪 Jest测试环境初始化完成");
