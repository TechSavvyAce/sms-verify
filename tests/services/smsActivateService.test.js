const SMSActivateService = require("../../services/SMSActivateService");
const axios = require("axios");

// Mock axios
jest.mock("axios");
const mockedAxios = axios;

describe("SMSActivateService", () => {
  let smsService;

  beforeEach(() => {
    smsService = new SMSActivateService();
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    test("should initialize with default values", () => {
      expect(smsService.apiKey).toBe(process.env.SMS_ACTIVATE_API_KEY);
      expect(smsService.baseURL).toBe("https://api.sms-activate.io/stubs/handler_api.php");
      expect(smsService.requestCount).toBe(0);
    });

    test("should use environment variables", () => {
      const originalApiKey = process.env.SMS_ACTIVATE_API_KEY;
      const originalBaseUrl = process.env.SMS_ACTIVATE_BASE_URL;

      process.env.SMS_ACTIVATE_API_KEY = "test-key";
      process.env.SMS_ACTIVATE_BASE_URL = "https://test.api.com";

      const service = new SMSActivateService();
      expect(service.apiKey).toBe("test-key");
      expect(service.baseURL).toBe("https://test.api.com");

      // 恢复环境变量
      process.env.SMS_ACTIVATE_API_KEY = originalApiKey;
      process.env.SMS_ACTIVATE_BASE_URL = originalBaseUrl;
    });
  });

  describe("makeRequest", () => {
    test("should make GET request successfully", async () => {
      const mockResponse = { data: "test response" };
      mockedAxios.mockResolvedValue(mockResponse);

      const params = { api_key: "test", action: "getBalance" };
      const result = await smsService.makeRequest(params);

      expect(mockedAxios).toHaveBeenCalledWith({
        method: "GET",
        url: smsService.baseURL,
        timeout: 30000,
        params: params,
        data: undefined,
      });
      expect(result).toBe("test response");
    });

    test("should handle rate limiting", async () => {
      const mockResponse = { data: "success" };
      mockedAxios.mockResolvedValue(mockResponse);

      const startTime = Date.now();

      // 连续发送两个请求
      await smsService.makeRequest({ action: "test1" });
      await smsService.makeRequest({ action: "test2" });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该至少等待1秒（minRequestInterval）
      expect(duration).toBeGreaterThanOrEqual(1000);
      expect(smsService.requestCount).toBe(2);
    });

    test("should handle axios errors", async () => {
      const error = new Error("Network error");
      mockedAxios.mockRejectedValue(error);

      await expect(smsService.makeRequest({ action: "test" })).rejects.toThrow("Network error");
    });

    test("should handle SMS-Activate error responses", async () => {
      mockedAxios.mockResolvedValue({ data: "BAD_KEY" });

      await expect(smsService.makeRequest({ action: "test" })).rejects.toThrow("API密钥错误");
    });

    test("should handle getStatus specific responses", async () => {
      mockedAxios.mockResolvedValue({ data: "STATUS_WAIT_CODE" });

      const result = await smsService.makeRequest({ action: "getStatus" });
      expect(result).toBe("STATUS_WAIT_CODE");
    });
  });

  describe("getBalance", () => {
    test("should get balance successfully", async () => {
      mockedAxios.mockResolvedValue({ data: "ACCESS_BALANCE:150.50" });

      const balance = await smsService.getBalance();
      expect(balance).toBe(150.5);
    });

    test("should handle balance API errors", async () => {
      mockedAxios.mockResolvedValue({ data: "BAD_KEY" });

      await expect(smsService.getBalance()).rejects.toThrow("API密钥错误");
    });

    test("should handle invalid balance format", async () => {
      mockedAxios.mockResolvedValue({ data: "INVALID_RESPONSE" });

      await expect(smsService.getBalance()).rejects.toThrow("获取余额失败");
    });
  });

  describe("getPrices", () => {
    test("should get all prices successfully", async () => {
      const mockPrices = {
        0: {
          telegram: { original: 0.18, markup: 0.2 },
          whatsapp: { original: 0.25, markup: 0.28 },
        },
        7: {
          telegram: { original: 0.2, markup: 0.22 },
        },
      };
      mockedAxios.mockResolvedValue({ data: mockPrices });

      const prices = await smsService.getPrices();
      expect(prices).toEqual(mockPrices);
    });

    test("should get prices for specific service and country", async () => {
      const mockPrices = {
        0: {
          telegram: { original: 0.18, markup: 0.2 },
        },
      };
      mockedAxios.mockResolvedValue({ data: mockPrices });

      const prices = await smsService.getPrices("telegram", 0);
      expect(prices).toEqual(mockPrices);
    });
  });

  describe("checkActivationStatus", () => {
    test("should check status successfully", async () => {
      mockedAxios.mockResolvedValue({ data: "STATUS_OK:123456" });

      const result = await smsService.checkActivationStatus("12345");
      expect(result).toEqual({
        status: "completed",
        code: "123456",
      });
    });

    test("should handle waiting status", async () => {
      mockedAxios.mockResolvedValue({ data: "STATUS_WAIT_CODE" });

      const result = await smsService.checkActivationStatus("12345");
      expect(result).toEqual({
        status: "pending",
        code: null,
      });
    });

    test("should handle cancelled status", async () => {
      mockedAxios.mockResolvedValue({ data: "STATUS_CANCEL" });

      const result = await smsService.checkActivationStatus("12345");
      expect(result).toEqual({
        status: "cancelled",
        code: null,
      });
    });
  });

  describe("getRentNumber", () => {
    test("should rent number successfully", async () => {
      const mockResponse = {
        status: "success",
        phone: {
          id: "12345",
          endDate: "2024-01-31T12:01:52",
          number: "79959707564",
        },
      };
      mockedAxios.mockResolvedValue({ data: mockResponse });

      const result = await smsService.getRentNumber(
        "telegram",
        4,
        "any",
        0,
        "https://webhook.url",
        false
      );

      expect(result).toEqual({
        success: true,
        id: "12345",
        phone: "79959707564",
        endDate: "2024-01-31T12:01:52",
      });
    });

    test("should handle rental errors", async () => {
      mockedAxios.mockResolvedValue({ data: "NO_NUMBERS" });

      const result = await smsService.getRentNumber("telegram", 4);
      expect(result).toEqual({
        success: false,
        message: "当前服务没有可用号码",
      });
    });
  });

  describe("getRentStatus", () => {
    test("should get rent status with messages", async () => {
      const mockResponse = {
        status: "success",
        quantity: "2",
        values: {
          0: {
            phoneFrom: "79180230628",
            text: "123456",
            service: "telegram",
            date: "2024-01-30 14:31:58",
          },
          1: {
            phoneFrom: "79180230629",
            text: "654321",
            service: "telegram",
            date: "2024-01-30 14:32:58",
          },
        },
      };
      mockedAxios.mockResolvedValue({ data: mockResponse });

      const result = await smsService.getRentStatus("12345");
      expect(result).toEqual({
        success: true,
        quantity: 2,
        values: expect.arrayContaining([
          expect.objectContaining({
            phoneFrom: "79180230628",
            text: "123456",
          }),
          expect.objectContaining({
            phoneFrom: "79180230629",
            text: "654321",
          }),
        ]),
      });
    });

    test("should handle no messages", async () => {
      const mockResponse = {
        status: "success",
        quantity: "0",
        values: {},
      };
      mockedAxios.mockResolvedValue({ data: mockResponse });

      const result = await smsService.getRentStatus("12345");
      expect(result).toEqual({
        success: true,
        quantity: 0,
        values: [],
      });
    });
  });

  describe("testConnection", () => {
    test("should test connection successfully", async () => {
      mockedAxios.mockResolvedValue({ data: "ACCESS_BALANCE:100.00" });

      const result = await smsService.testConnection();
      expect(result).toEqual({
        success: true,
        message: "API连接正常",
        balance: 100.0,
        timestamp: expect.any(String),
      });
    });

    test("should handle connection failure", async () => {
      mockedAxios.mockRejectedValue(new Error("Connection failed"));

      const result = await smsService.testConnection();
      expect(result).toEqual({
        success: false,
        message: "API连接失败",
        error: "Connection failed",
        timestamp: expect.any(String),
      });
    });

    test("should handle missing API key", async () => {
      const service = new SMSActivateService();
      service.apiKey = null;

      const result = await service.testConnection();
      expect(result).toEqual({
        success: false,
        message: "API密钥未配置",
        details: "请在环境变量中设置 SMS_ACTIVATE_API_KEY",
      });
    });
  });

  describe("validateApiPermissions", () => {
    test("should validate permissions successfully", async () => {
      // Mock successful responses for all permission checks
      mockedAxios
        .mockResolvedValueOnce({ data: "ACCESS_BALANCE:100.00" }) // getBalance
        .mockResolvedValueOnce({ data: {} }) // getServices
        .mockResolvedValueOnce({ data: [] }) // getOperators
        .mockResolvedValueOnce({ data: {} }); // getPrices

      const result = await smsService.validateApiPermissions();

      expect(result.valid).toBe(true);
      expect(result.permissions.getBalance).toBe(true);
      expect(result.permissions.getServices).toBe(true);
      expect(result.permissions.getOperators).toBe(true);
      expect(result.permissions.getPrices).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should handle permission failures", async () => {
      mockedAxios
        .mockRejectedValueOnce(new Error("Balance error"))
        .mockRejectedValueOnce(new Error("Services error"))
        .mockResolvedValueOnce({ data: [] }) // getOperators succeeds
        .mockResolvedValueOnce({ data: {} }); // getPrices succeeds

      const result = await smsService.validateApiPermissions();

      expect(result.valid).toBe(true); // Still valid if 3/4 pass
      expect(result.permissions.getBalance).toBe(false);
      expect(result.permissions.getServices).toBe(false);
      expect(result.permissions.getOperators).toBe(true);
      expect(result.permissions.getPrices).toBe(true);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("Error Code Mapping", () => {
    test("should map error codes correctly", () => {
      expect(smsService.errorCodes.BAD_KEY).toBe("API密钥错误");
      expect(smsService.errorCodes.NO_BALANCE).toBe("余额不足");
      expect(smsService.errorCodes.NO_NUMBERS).toBe("当前服务没有可用号码");
    });
  });

  describe("Status Mapping", () => {
    test("should map API status to local status", () => {
      expect(smsService.mapApiStatusToLocalStatus("STATUS_WAIT_CODE")).toBe("pending");
      expect(smsService.mapApiStatusToLocalStatus("STATUS_OK")).toBe("completed");
      expect(smsService.mapApiStatusToLocalStatus("STATUS_CANCEL")).toBe("cancelled");
    });
  });
});
