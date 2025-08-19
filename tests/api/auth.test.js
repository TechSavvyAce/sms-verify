const request = require("supertest");
const app = require("../../server").app;
const { User } = require("../../models");
const bcrypt = require("bcryptjs");

describe("Authentication API", () => {
  describe("POST /api/auth/register", () => {
    test("should register a new user successfully", async () => {
      const userData = {
        username: "newuser",
        email: "newuser@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      };

      const response = await request(app).post("/api/auth/register").send(userData).expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("requires_verification", true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user).not.toHaveProperty("password_hash");

      // 验证用户是否已创建
      const user = await User.findOne({ where: { email: userData.email } });
      expect(user).toBeTruthy();
      expect(user.status).toBe("pending");
      expect(user.email_verified).toBe(false);
    });

    test("should fail with invalid email", async () => {
      const userData = {
        username: "testuser",
        email: "invalid-email",
        password: "Password123",
        confirmPassword: "Password123",
      };

      const response = await request(app).post("/api/auth/register").send(userData).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    test("should fail with password mismatch", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "Password123",
        confirmPassword: "DifferentPassword",
      };

      const response = await request(app).post("/api/auth/register").send(userData).expect(400);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    });

    test("should fail with duplicate email", async () => {
      // 创建第一个用户
      await testHelpers.createTestUser({
        email: "duplicate@example.com",
        username: "user1",
      });

      const userData = {
        username: "user2",
        email: "duplicate@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      };

      const response = await request(app).post("/api/auth/register").send(userData).expect(409);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser;

    beforeEach(async () => {
      testUser = await testHelpers.createTestUser({
        email: "logintest@example.com",
        username: "logintest",
      });
    });

    test("should login successfully with email", async () => {
      const loginData = {
        username: "logintest@example.com",
        password: "password123",
      };

      const response = await request(app).post("/api/auth/login").send(loginData).expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    test("should login successfully with username", async () => {
      const loginData = {
        username: "logintest",
        password: "password123",
      };

      const response = await request(app).post("/api/auth/login").send(loginData).expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    test("should fail with invalid credentials", async () => {
      const loginData = {
        username: "logintest",
        password: "wrongpassword",
      };

      const response = await request(app).post("/api/auth/login").send(loginData).expect(401);

      expect(response.body).toHaveProperty("success", false);
      expect(response.body.error).toHaveProperty("code", "AUTHENTICATION_ERROR");
    });

    test("should fail with non-existent user", async () => {
      const loginData = {
        username: "nonexistent",
        password: "password123",
      };

      const response = await request(app).post("/api/auth/login").send(loginData).expect(401);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should fail with inactive user", async () => {
      const inactiveUser = await testHelpers.createTestUser({
        email: "inactive@example.com",
        username: "inactive",
        status: "suspended",
      });

      const loginData = {
        username: "inactive",
        password: "password123",
      };

      const response = await request(app).post("/api/auth/login").send(loginData).expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/auth/refresh", () => {
    let testUser, refreshToken;

    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();

      // 先登录获取refresh token
      const loginResponse = await request(app).post("/api/auth/login").send({
        username: testUser.username,
        password: "password123",
      });

      refreshToken = loginResponse.body.data.refreshToken;
    });

    test("should refresh token successfully", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
    });

    test("should fail with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should fail with missing refresh token", async () => {
      const response = await request(app).post("/api/auth/refresh").send({}).expect(400);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/auth/logout", () => {
    let testUser, accessToken;

    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      accessToken = testHelpers.createTestToken(testUser.id);
    });

    test("should logout successfully", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("message");
    });

    test("should fail without authentication", async () => {
      const response = await request(app).post("/api/auth/logout").expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("GET /api/auth/profile", () => {
    let testUser, accessToken;

    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      accessToken = testHelpers.createTestToken(testUser.id);
    });

    test("should get user profile successfully", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty("password_hash");
    });

    test("should fail without authentication", async () => {
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should fail with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    let testUser;

    beforeEach(async () => {
      testUser = await testHelpers.createTestUser({
        status: "pending",
        email_verified: false,
        email_verification_token: "test-verification-token",
        email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    test("should verify email successfully", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "test-verification-token" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("accessToken");

      // 验证用户状态已更新
      await testUser.reload();
      expect(testUser.email_verified).toBe(true);
      expect(testUser.status).toBe("active");
    });

    test("should fail with invalid token", async () => {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "invalid-token" })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });

    test("should fail with expired token", async () => {
      // 设置过期时间为过去
      await testUser.update({
        email_verification_expires: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "test-verification-token" })
        .expect(400);

      expect(response.body).toHaveProperty("success", false);
    });
  });

  describe("Rate Limiting", () => {
    test("should apply rate limiting to login endpoint", async () => {
      const loginData = {
        username: "nonexistent",
        password: "wrongpassword",
      };

      // 发送多个请求超过限制
      const requests = Array(6)
        .fill()
        .map(() => request(app).post("/api/auth/login").send(loginData));

      const responses = await Promise.all(requests);

      // 最后一个请求应该被限制
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toHaveProperty("code", "RATE_LIMIT_ERROR");
    }, 30000);
  });
});
