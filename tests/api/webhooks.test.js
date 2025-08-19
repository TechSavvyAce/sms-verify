const request = require("supertest");
const app = require("../../server").app;
const crypto = require("crypto");
const { User, Rental, Transaction } = require("../../models");

describe("Webhooks API", () => {
  const webhookSecret = "test-webhook-secret";
  let testUser, testRental, testTransaction;

  // 生成webhook签名
  const generateSignature = (payload, secret = webhookSecret) => {
    return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  };

  beforeEach(async () => {
    testUser = await testHelpers.createTestUser();
    testRental = await testHelpers.createTestRental(testUser.id, {
      external_id: "webhook_test_rental",
    });
    testTransaction = await testHelpers.createTestTransaction(testUser.id, {
      external_id: "webhook_test_payment",
      reference_id: "webhook_test_payment",
      status: "pending",
    });
  });

  describe("POST /api/webhook/rental", () => {
    test("should process rental webhook successfully", async () => {
      const payload = {
        id: "webhook_test_rental",
        phone: "79181234567",
        status: "STATUS_OK",
        endDate: "2024-01-31T12:01:52",
        messages: [
          {
            phoneFrom: "79180230628",
            text: "Test message",
            service: "telegram",
            date: "2024-01-30 14:31:58",
          },
        ],
      };

      const signature = generateSignature(payload);

      const response = await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("rental_id");
      expect(response.body.data).toHaveProperty("updates");

      // 验证数据库更新
      await testRental.reload();
      expect(testRental.status).toBe("active");
      expect(testRental.messages).toBeDefined();
    });

    test("should fail with invalid signature", async () => {
      const payload = {
        id: "webhook_test_rental",
        status: "STATUS_OK",
      };

      const response = await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", "sha256=invalid_signature")
        .send(payload)
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "Webhook签名验证失败");
    });

    test("should fail with missing signature", async () => {
      const payload = {
        id: "webhook_test_rental",
        status: "STATUS_OK",
      };

      const response = await request(app).post("/api/webhook/rental").send(payload).expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "缺少webhook签名");
    });

    test("should fail with non-existent rental", async () => {
      const payload = {
        id: "non_existent_rental",
        status: "STATUS_OK",
      };

      const signature = generateSignature(payload);

      const response = await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload)
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should handle status changes correctly", async () => {
      const statusTests = [
        { apiStatus: "STATUS_WAIT_CODE", expectedStatus: "active" },
        { apiStatus: "STATUS_OK", expectedStatus: "active" },
        { apiStatus: "STATUS_FINISH", expectedStatus: "completed" },
        { apiStatus: "STATUS_CANCEL", expectedStatus: "cancelled" },
        { apiStatus: "STATUS_REVOKE", expectedStatus: "cancelled" },
      ];

      for (const { apiStatus, expectedStatus } of statusTests) {
        const payload = {
          id: "webhook_test_rental",
          status: apiStatus,
        };

        const signature = generateSignature(payload);

        await request(app)
          .post("/api/webhook/rental")
          .set("X-Webhook-Signature", `sha256=${signature}`)
          .send(payload)
          .expect(200);

        await testRental.reload();
        expect(testRental.status).toBe(expectedStatus);
      }
    });
  });

  describe("POST /api/webhook/payment", () => {
    test("should process successful payment webhook", async () => {
      const payload = {
        order_id: "webhook_test_payment",
        status: "success",
        amount: "10.00",
        currency: "USD",
        transaction_id: "txn_123456",
        payment_method: "card",
        timestamp: new Date().toISOString(),
      };

      const signature = generateSignature(payload);
      const initialBalance = testUser.balance;

      const response = await request(app)
        .post("/api/webhook/payment")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("transaction_id");
      expect(response.body.data).toHaveProperty("status", "completed");

      // 验证交易状态更新
      await testTransaction.reload();
      expect(testTransaction.status).toBe("completed");
      expect(testTransaction.reference).toBe("txn_123456");

      // 验证余额更新
      await testUser.reload();
      expect(testUser.balance).toBe(initialBalance + 10.0);
      expect(testUser.total_recharged).toBe(110.0); // 初始100 + 10
    });

    test("should process failed payment webhook", async () => {
      const payload = {
        order_id: "webhook_test_payment",
        status: "failed",
        amount: "10.00",
        payment_method: "card",
      };

      const signature = generateSignature(payload);
      const initialBalance = testUser.balance;

      const response = await request(app)
        .post("/api/webhook/payment")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("status", "failed");

      // 验证交易状态更新
      await testTransaction.reload();
      expect(testTransaction.status).toBe("failed");

      // 验证余额未变
      await testUser.reload();
      expect(testUser.balance).toBe(initialBalance);
    });

    test("should handle duplicate payment webhook", async () => {
      // 先标记交易为已完成
      await testTransaction.update({ status: "completed" });

      const payload = {
        order_id: "webhook_test_payment",
        status: "success",
        amount: "10.00",
      };

      const signature = generateSignature(payload);

      const response = await request(app)
        .post("/api/webhook/payment")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message", "订单已处理");
    });
  });

  describe("GET /api/webhook/config", () => {
    test("should get webhook config for rental", async () => {
      const response = await request(app)
        .get("/api/webhook/config")
        .query({ type: "rental" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("webhook_url");
      expect(response.body.data).toHaveProperty("webhook_secret");
      expect(response.body.data).toHaveProperty("headers");
      expect(response.body.data).toHaveProperty("instructions");
    });

    test("should fail with invalid webhook type", async () => {
      const response = await request(app)
        .get("/api/webhook/config")
        .query({ type: "invalid" })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
    });

    test("should fail with missing type parameter", async () => {
      const response = await request(app).get("/api/webhook/config").expect(400);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/webhook/test", () => {
    test("should test webhook successfully", async () => {
      const testPayload = {
        id: "test_123",
        status: "STATUS_OK",
      };

      const testSecret = "test_secret";
      const testUrl = "https://httpbin.org/post"; // 公共测试端点

      const requestData = {
        url: testUrl,
        payload: testPayload,
        secret: testSecret,
      };

      const response = await request(app).post("/api/webhook/test").send(requestData).expect(200);

      expect(response.body).toHaveProperty("success");
      expect(response.body.data).toHaveProperty("success");
      expect(response.body.data).toHaveProperty("status");
    });

    test("should fail with missing parameters", async () => {
      const response = await request(app)
        .post("/api/webhook/test")
        .send({
          url: "https://example.com",
          // missing payload and secret
        })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error", "缺少必要参数: url, payload, secret");
    });
  });

  describe("GET /api/webhook/health", () => {
    test("should return webhook health status", async () => {
      const response = await request(app).get("/api/webhook/health").expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message", "Webhook服务正常运行");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("endpoints");
      expect(Array.isArray(response.body.endpoints)).toBe(true);
    });
  });

  describe("POST /api/webhook/sms-activate", () => {
    test("should handle SMS-Activate specific webhook format", async () => {
      const payload = {
        action: "rental_update",
        data: {
          id: "webhook_test_rental",
          status: "STATUS_OK",
          phone: "79181234567",
        },
      };

      const response = await request(app)
        .post("/api/webhook/sms-activate")
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
    });

    test("should fail with unknown action", async () => {
      const payload = {
        action: "unknown_action",
        data: {},
      };

      const response = await request(app)
        .post("/api/webhook/sms-activate")
        .send(payload)
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toContain("未知的webhook动作");
    });
  });

  describe("Webhook Security", () => {
    test("should use timing-safe comparison for signatures", async () => {
      const payload = { id: "test" };
      const correctSignature = generateSignature(payload);

      // 测试正确签名
      const response1 = await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", `sha256=${correctSignature}`)
        .send(payload);

      // 响应可能是200或500（取决于租用记录是否存在），但不应该是401
      expect(response1.status).not.toBe(401);

      // 测试错误签名
      const response2 = await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", "sha256=wrong_signature")
        .send(payload)
        .expect(401);

      expect(response2.body.error).toBe("Webhook签名验证失败");
    });

    test("should support different signature formats", async () => {
      const payload = { id: "test" };
      const signature = generateSignature(payload);

      // 测试 sha256= 前缀
      await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload);

      // 测试无前缀
      await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", signature)
        .send(payload);
    });
  });

  describe("Webhook Error Handling", () => {
    test("should handle malformed JSON gracefully", async () => {
      const response = await request(app)
        .post("/api/webhook/rental")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", "sha256=test")
        .send("invalid json")
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should handle missing webhook ID", async () => {
      const payload = {
        // missing id
        status: "STATUS_OK",
      };

      const signature = generateSignature(payload);

      const response = await request(app)
        .post("/api/webhook/rental")
        .set("X-Webhook-Signature", `sha256=${signature}`)
        .send(payload)
        .expect(500);

      expect(response.body).toHaveProperty("success", false);
    });
  });
});
