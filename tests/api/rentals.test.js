const request = require("supertest");
const app = require("../../server").app;
const { User, Rental, Transaction } = require("../../models");

// Mock SMS-Activate Service
jest.mock("../../services/SMSActivateService", () => {
  return jest.fn().mockImplementation(() => ({
    getRentServicesAndCountries: jest.fn().mockResolvedValue({
      success: true,
      services: { telegram: "Telegram" },
      countries: { 0: "Russia" },
    }),
    getRentNumber: jest.fn().mockResolvedValue({
      success: true,
      id: "12345",
      phone: "79181234567",
      endDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    }),
    getRentStatus: jest.fn().mockResolvedValue({
      success: true,
      quantity: 1,
      values: [
        {
          phoneFrom: "79180230628",
          text: "Test SMS",
          service: "telegram",
          date: new Date().toISOString(),
        },
      ],
    }),
    setRentStatus: jest.fn().mockResolvedValue({
      success: true,
    }),
    getRentList: jest.fn().mockResolvedValue({
      success: true,
      values: [],
    }),
    continueRentNumber: jest.fn().mockResolvedValue({
      success: true,
      id: "12345",
      phone: "79181234567",
      endDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    }),
  }));
});

describe("Rentals API", () => {
  let testUser, accessToken;

  beforeEach(async () => {
    testUser = await testHelpers.createTestUser({
      balance: 100.0,
    });
    accessToken = testHelpers.createTestToken(testUser.id);
  });

  describe("GET /api/rental/services", () => {
    test("should get rental services and countries", async () => {
      const response = await request(app)
        .get("/api/rental/services")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("services");
      expect(response.body.data).toHaveProperty("countries");
    });

    test("should fail without authentication", async () => {
      const response = await request(app).get("/api/rental/services").expect(401);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should handle query parameters", async () => {
      const response = await request(app)
        .get("/api/rental/services")
        .query({
          time: 12,
          operator: "mts",
          country: 7,
          incomingCall: true,
        })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
    });
  });

  describe("POST /api/rental/order", () => {
    test("should create rental order successfully", async () => {
      const orderData = {
        service: "telegram",
        time: 4,
        country: 0,
        operator: "any",
        incomingCall: false,
      };

      const response = await request(app)
        .post("/api/rental/order")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(orderData)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("rental");
      expect(response.body.data.rental).toHaveProperty("phone_number");
      expect(response.body.data.rental).toHaveProperty("external_id");

      // 验证数据库记录
      const rental = await Rental.findOne({
        where: { user_id: testUser.id },
      });
      expect(rental).toBeTruthy();
      expect(rental.service).toBe(orderData.service);
      expect(rental.time_hours).toBe(orderData.time);

      // 验证余额扣减
      await testUser.reload();
      expect(testUser.balance).toBeLessThan(100.0);

      // 验证交易记录
      const transaction = await Transaction.findOne({
        where: { user_id: testUser.id, type: "rental" },
      });
      expect(transaction).toBeTruthy();
      expect(transaction.amount).toBeLessThan(0);
    });

    test("should fail with insufficient balance", async () => {
      // 设置余额不足
      await testUser.update({ balance: 0.01 });

      const orderData = {
        service: "telegram",
        time: 4,
        country: 0,
        operator: "any",
      };

      const response = await request(app)
        .post("/api/rental/order")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "余额不足");
    });

    test("should fail with invalid service", async () => {
      const orderData = {
        service: "", // 空服务名
        time: 4,
        country: 0,
      };

      const response = await request(app)
        .post("/api/rental/order")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should fail without authentication", async () => {
      const orderData = {
        service: "telegram",
        time: 4,
        country: 0,
      };

      const response = await request(app).post("/api/rental/order").send(orderData).expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("GET /api/rental/:id/status", () => {
    let testRental;

    beforeEach(async () => {
      testRental = await testHelpers.createTestRental(testUser.id);
    });

    test("should get rental status successfully", async () => {
      const response = await request(app)
        .get(`/api/rental/${testRental.id}/status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("rental");
      expect(response.body.data).toHaveProperty("messages");
      expect(response.body.data.rental.id).toBe(testRental.id);
    });

    test("should fail with non-existent rental", async () => {
      const response = await request(app)
        .get("/api/rental/99999/status")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should fail with unauthorized access", async () => {
      const otherUser = await testHelpers.createTestUser({
        email: "other@example.com",
        username: "other",
      });
      const otherToken = testHelpers.createTestToken(otherUser.id);

      const response = await request(app)
        .get(`/api/rental/${testRental.id}/status`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/rental/:id/cancel", () => {
    let testRental;

    beforeEach(async () => {
      testRental = await testHelpers.createTestRental(testUser.id, {
        status: "active",
      });
    });

    test("should cancel rental successfully", async () => {
      const response = await request(app)
        .post(`/api/rental/${testRental.id}/cancel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);

      // 验证状态更新
      await testRental.reload();
      expect(testRental.status).toBe("cancelled");
    });

    test("should fail to cancel already completed rental", async () => {
      await testRental.update({ status: "completed" });

      const response = await request(app)
        .post(`/api/rental/${testRental.id}/cancel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/rental/:id/finish", () => {
    let testRental;

    beforeEach(async () => {
      testRental = await testHelpers.createTestRental(testUser.id, {
        status: "active",
      });
    });

    test("should finish rental successfully", async () => {
      const response = await request(app)
        .post(`/api/rental/${testRental.id}/finish`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);

      // 验证状态更新
      await testRental.reload();
      expect(testRental.status).toBe("completed");
    });
  });

  describe("POST /api/rental/:id/extend", () => {
    let testRental;

    beforeEach(async () => {
      testRental = await testHelpers.createTestRental(testUser.id, {
        status: "active",
      });
    });

    test("should extend rental successfully", async () => {
      const extendData = {
        time: 4,
      };

      const response = await request(app)
        .post(`/api/rental/${testRental.id}/extend`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(extendData)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("rental");

      // 验证余额扣减
      await testUser.reload();
      expect(testUser.balance).toBeLessThan(100.0);

      // 验证交易记录
      const transaction = await Transaction.findOne({
        where: {
          user_id: testUser.id,
          type: "rental_extend",
        },
      });
      expect(transaction).toBeTruthy();
    });

    test("should fail with insufficient balance for extension", async () => {
      await testUser.update({ balance: 0.01 });

      const extendData = {
        time: 4,
      };

      const response = await request(app)
        .post(`/api/rental/${testRental.id}/extend`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(extendData)
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("GET /api/rental/list", () => {
    beforeEach(async () => {
      // 创建多个租用记录
      await Promise.all([
        testHelpers.createTestRental(testUser.id, { status: "active" }),
        testHelpers.createTestRental(testUser.id, { status: "completed" }),
        testHelpers.createTestRental(testUser.id, { status: "cancelled" }),
      ]);
    });

    test("should get rental list successfully", async () => {
      const response = await request(app)
        .get("/api/rental/list")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("rentals");
      expect(response.body.data).toHaveProperty("total");
      expect(response.body.data).toHaveProperty("pagination");
      expect(Array.isArray(response.body.data.rentals)).toBe(true);
      expect(response.body.data.rentals.length).toBeGreaterThan(0);
    });

    test("should support pagination", async () => {
      const response = await request(app)
        .get("/api/rental/list")
        .query({ page: 1, limit: 2 })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.rentals.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toHaveProperty("page", 1);
      expect(response.body.data.pagination).toHaveProperty("limit", 2);
    });

    test("should support status filtering", async () => {
      const response = await request(app)
        .get("/api/rental/list")
        .query({ status: "active" })
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      response.body.data.rentals.forEach((rental) => {
        expect(rental.status).toBe("active");
      });
    });

    test("should update expired rentals", async () => {
      // 创建过期的租用
      const expiredRental = await testHelpers.createTestRental(testUser.id, {
        status: "active",
        end_time: new Date(Date.now() - 60 * 60 * 1000), // 1小时前过期
      });

      const response = await request(app)
        .get("/api/rental/list")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // 验证过期状态已更新
      await expiredRental.reload();
      expect(expiredRental.status).toBe("expired");
    });
  });

  describe("Rate Limiting", () => {
    test("should apply rate limiting to rental order endpoint", async () => {
      const orderData = {
        service: "telegram",
        time: 4,
        country: 0,
      };

      // 发送多个请求超过限制
      const requests = Array(6)
        .fill()
        .map(() =>
          request(app)
            .post("/api/rental/order")
            .set("Authorization", `Bearer ${accessToken}`)
            .send(orderData)
        );

      const responses = await Promise.all(requests);

      // 检查是否有请求被限制
      const limitedResponses = responses.filter((r) => r.status === 429);
      expect(limitedResponses.length).toBeGreaterThan(0);
    }, 30000);
  });
});
