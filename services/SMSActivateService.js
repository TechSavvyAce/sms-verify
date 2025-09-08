const axios = require("axios");
const logger = require("../utils/logger");
const { delay, calculateMarkupPrice } = require("../utils/helpers");

class SMSActivateService {
  constructor() {
    this.apiKey = process.env.SMS_ACTIVATE_API_KEY;
    this.baseURL =
      process.env.SMS_ACTIVATE_BASE_URL || "https://api.sms-activate.io/stubs/handler_api.php";
    this.userId = process.env.SMS_ACTIVATE_USER_ID || "2320238";
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 最小请求间隔1秒

    // 错误代码映射
    this.errorCodes = {
      ACCESS_ACTIVATION: "服务成功激活",
      ACCESS_CANCEL: "激活已取消",
      ACCESS_READY: "等待新短信",
      ACCESS_RETRY_GET: "号码就绪确认",
      ACCOUNT_INACTIVE: "没有可用号码",
      ALREADY_FINISH: "租用已完成",
      ALREADY_CANCEL: "租用已取消",
      BAD_ACTION: "无效操作",
      BAD_SERVICE: "无效服务名称",
      BAD_KEY: "API密钥错误",
      NO_KEY: "缺少参数",
      BAD_STATUS: "尝试设置不存在的状态",
      BANNED: "账户被封禁",
      CANT_CANCEL: "无法取消租用（超过20分钟）",
      ERROR_SQL: "参数值无效",
      NO_NUMBERS: "当前服务没有可用号码",
      NO_BALANCE: "余额不足",
      NO_YULA_MAIL: "Mail.ru服务需要余额大于500卢布",
      NO_CONNECTION: "无法连接到sms-activate服务器",
      NO_ID_RENT: "未指定租用ID",
      NO_ACTIVATION: "指定的激活ID不存在",
      STATUS_CANCEL: "激活/租用已取消",
      STATUS_FINISH: "租用已完成",
      STATUS_WAIT_CODE: "等待第一条短信",
      STATUS_WAIT_RETRY: "等待代码确认",
      SQL_ERROR: "参数值无效",
      INVALID_PHONE: "号码不是您租用的",
      INCORECT_STATUS: "状态缺失或错误",
      WRONG_SERVICE: "服务不支持转发",
      WRONG_SECURITY: "传递激活ID时出错",
      WRONG_MAX_PRICE: "价格超出限制",
      NO_BALANCE_FORWARD: "余额不足以购买转发",
      CHANNELS_LIMIT: "账户被限制",
      ORDER_ALREADY_EXISTS: "订单已存在",
    };

    // 服务名称中英文对照
    this.serviceNames = {
      vk: "VK (ВКонтакте)",
      ok: "Одноклассники",
      whatsapp: "WhatsApp",
      viber: "Viber",
      telegram: "Telegram",
      tg: "Telegram", // 添加 tg 别名
      instagram: "Instagram",
      insta: "Instagram", // 添加 insta 别名
      facebook: "Facebook",
      fb: "Facebook", // 添加 fb 别名
      twitter: "Twitter",
      linkedin: "LinkedIn",
      google: "Google",
      yahoo: "Yahoo",
      microsoft: "Microsoft",
      apple: "Apple",
      amazon: "Amazon",
      uber: "Uber",
      airbnb: "Airbnb",
      wechat: "微信",
      alipay: "支付宝",
      taobao: "淘宝",
      jd: "京东",
      baidu: "百度",
      qq: "QQ",
      meituan: "美团",
      didi: "滴滴",
      douyin: "抖音",
      kuaishou: "快手",
    };

    // 国家名称中英文对照
    this.countryNames = {
      0: "俄罗斯",
      1: "乌克兰",
      2: "哈萨克斯坦",
      3: "中国",
      4: "菲律宾",
      5: "缅甸",
      6: "印度尼西亚",
      7: "马来西亚",
      8: "肯尼亚",
      9: "坦桑尼亚",
      10: "越南",
      11: "吉尔吉斯斯坦",
      12: "美国",
      13: "以色列",
      14: "香港",
      15: "波兰",
      16: "英国",
      17: "马达加斯加",
      18: "刚果",
      19: "尼日利亚",
      20: "澳门",
      21: "埃及",
      22: "印度",
      23: "爱尔兰",
      24: "柬埔寨",
      25: "老挝",
      26: "海地",
      27: "科特迪瓦",
      28: "冈比亚",
      29: "塞尔维亚",
      30: "也门",
      31: "南非",
      32: "罗马尼亚",
      33: "哥伦比亚",
      34: "爱沙尼亚",
      35: "阿塞拜疆",
      36: "加拿大",
      37: "摩洛哥",
      38: "加纳",
      39: "阿根廷",
      40: "乌兹别克斯坦",
      41: "喀麦隆",
      42: "乍得",
      43: "德国",
      44: "立陶宛",
      45: "克罗地亚",
      46: "瑞典",
      47: "伊拉克",
      48: "荷兰",
      49: "拉脱维亚",
      50: "奥地利",
      51: "白俄罗斯",
      52: "泰国",
      53: "沙特阿拉伯",
      54: "墨西哥",
      55: "台湾",
      56: "西班牙",
      57: "伊朗",
      58: "阿尔及利亚",
      59: "斯洛文尼亚",
      60: "孟加拉国",
      61: "塞内加尔",
      62: "土耳其",
      63: "捷克",
      64: "斯里兰卡",
      65: "秘鲁",
      66: "巴基斯坦",
      67: "新西兰",
      68: "几内亚",
      69: "马里",
      70: "委内瑞拉",
      71: "埃塞俄比亚",
      72: "蒙古",
      73: "巴西",
      74: "阿富汗",
      75: "乌干达",
      76: "安哥拉",
      77: "塞浦路斯",
      78: "法国",
      79: "巴布亚新几内亚",
      80: "莫桑比克",
      81: "尼泊尔",
      82: "比利时",
      83: "保加利亚",
      84: "匈牙利",
      85: "摩尔多瓦",
      86: "意大利",
      87: "巴拉圭",
      88: "洪都拉斯",
      89: "突尼斯",
      90: "尼加拉瓜",
      91: "津巴布韦",
      92: "玻利维亚",
      93: "哥斯达黎加",
      94: "危地马拉",
      95: "阿联酋",
      96: "津巴布韦",
      97: "科威特",
      98: "约旦",
      99: "黎巴嫩",
      100: "厄瓜多尔",
      101: "巴拿马",
      102: "多米尼加",
      103: "萨尔瓦多",
      104: "利比亚",
      105: "牙买加",
      106: "特立尼达和多巴哥",
      107: "厄立特里亚",
    };
  }

  /**
   * 速率限制
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await delay(this.minRequestInterval - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * 发送请求到SMS-Activate API
   */
  async makeRequest(params, method = "GET") {
    await this.rateLimit();

    try {
      // SMS Activate API 总是使用 GET 参数，即使 method 是 POST
      const config = {
        method,
        url: this.baseURL,
        timeout: 30000,
        params: params, // 总是使用 params，不管 method 是什么
        data: undefined, // 不使用 data
      };

      logger.debug("SMS-Activate API请求:", { params, method });

      // 构建完整的URL用于调试
      const queryString = new URLSearchParams(params).toString();
      const fullUrl = `${this.baseURL}?${queryString}`;
      logger.info("完整请求URL:", fullUrl);

      const response = await axios(config);
      const result = response.data;

      logger.debug("SMS-Activate API响应:", { result });

      // 检查错误响应 - 支持字符串和JSON格式
      // 但是某些状态响应（如STATUS_WAIT_CODE）对于getStatus操作是正常的，不应该被当作错误
      if (typeof result === "string") {
        // 对于getStatus操作，这些状态是正常的响应，不是错误
        if (
          params.action === "getStatus" &&
          (result === "STATUS_WAIT_CODE" ||
            result === "STATUS_WAIT_RETRY" ||
            result === "STATUS_CANCEL" ||
            result === "STATUS_FINISH" ||
            result.startsWith("STATUS_OK:"))
        ) {
          return result; // 返回正常的状态响应
        }

        // 检查其他错误响应
        if (this.errorCodes[result]) {
          throw new Error(this.errorCodes[result]);
        }
      }

      // 检查JSON格式的错误响应
      if (typeof result === "object" && result.result && this.errorCodes[result.result]) {
        throw new Error(this.errorCodes[result.result]);
      }

      return result;
    } catch (error) {
      logger.error("SMS-Activate API错误:", {
        error: error.message,
        params,
        method,
      });

      if (error.response) {
        throw new Error(`API请求失败: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        throw new Error("网络连接失败，请检查网络连接");
      } else {
        throw error;
      }
    }
  }

  /**
   * 测试API连接和密钥
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return { success: false, error: "API密钥未配置" };
      }

      const result = await this.makeRequest({
        api_key: this.apiKey,
        action: "getBalance",
      });

      if (typeof result === "string" && result.includes("ACCESS_BALANCE:")) {
        const balance = parseFloat(result.split(":")[1]);
        return {
          success: true,
          balance,
          currency: "USD",
          message: "API连接成功",
        };
      }

      return { success: false, error: "API响应格式错误" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取运营商列表
   */
  async getOperators(country = null) {
    if (!this.apiKey) {
      throw new Error("SMS Activate API密钥未配置");
    }

    const params = {
      api_key: this.apiKey,
      action: "getOperators",
    };

    if (country !== null) {
      params.country = country;
    }

    try {
      const result = await this.makeRequest(params, "GET");

      // 处理成功响应
      if (result.status === "success" && result.countryOperators) {
        return result.countryOperators;
      }

      // 处理错误响应 - 运营商未找到
      if (result.status === "error" && result.error === "OPERATORS_NOT_FOUND") {
        logger.warn(`国家 ${country} 没有可用的运营商信息`);
        return {}; // 返回空对象而不是抛出错误
      }

      // 处理其他错误
      if (result.status === "error") {
        logger.warn(`获取运营商列表失败: ${result.error}`);
        return {}; // 返回空对象而不是抛出错误
      }

      // 处理未知响应格式
      logger.warn("获取运营商列表失败: 响应格式错误", result);
      return {};
    } catch (error) {
      logger.error("获取运营商列表失败:", error);
      return {}; // 返回空对象而不是抛出错误
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance() {
    const result = await this.makeRequest({
      api_key: this.apiKey,
      action: "getBalance",
    });

    // 返回格式: "ACCESS_BALANCE:balance"
    if (typeof result === "string" && result.includes(":")) {
      const balance = parseFloat(result.split(":")[1]);
      return { balance, currency: "USD" };
    }

    throw new Error("获取余额失败");
  }

  /**
   * 获取服务列表
   */
  async getServices() {
    const result = await this.makeRequest({
      api_key: this.apiKey,
      action: "getNumbersStatus",
    });

    if (typeof result === "object") {
      const services = [];
      for (const [serviceKey, count] of Object.entries(result)) {
        const cleanKey = serviceKey.replace(/_\d+$/, "");
        if (count > 0) {
          services.push({
            key: cleanKey,
            name: this.serviceNames[cleanKey] || cleanKey,
            available: count,
            popular: ["whatsapp", "telegram", "instagram", "wechat", "qq"].includes(cleanKey),
          });
        }
      }

      // 按受欢迎程度和可用性排序
      services.sort((a, b) => {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return b.available - a.available;
      });

      return services;
    }

    return [];
  }

  /**
   * 获取指定服务的国家列表
   */
  async getCountriesForService(service) {
    const result = await this.makeRequest({
      api_key: this.apiKey,
      action: "getNumbersStatus",
      service: service,
    });

    if (typeof result === "object") {
      const countries = [];
      for (const [key, count] of Object.entries(result)) {
        const countryMatch = key.match(/_(\d+)$/);
        if (countryMatch && count > 0) {
          const countryId = parseInt(countryMatch[1]);
          countries.push({
            id: countryId,
            name: this.countryNames[countryId] || `国家${countryId}`,
            available: count,
            code: this.getCountryCode(countryId),
          });
        }
      }

      // 按可用性排序
      countries.sort((a, b) => b.available - a.available);
      return countries;
    }

    return [];
  }

  /**
   * 获取价格信息
   */
  async getPrices(service = null, country = null) {
    const params = {
      api_key: this.apiKey,
      action: "getPrices",
    };

    if (service) params.service = service;
    if (country !== null) params.country = country;

    const result = await this.makeRequest(params);

    if (typeof result === "object") {
      const prices = {};

      for (const [countryId, services] of Object.entries(result)) {
        if (typeof services === "object") {
          prices[countryId] = {};
          for (const [serviceKey, priceData] of Object.entries(services)) {
            if (typeof priceData === "object" && priceData.cost) {
              const originalPrice = parseFloat(priceData.cost);
              const markupPrice = calculateMarkupPrice(originalPrice);

              prices[countryId][serviceKey] = {
                original: originalPrice,
                markup: markupPrice,
                currency: "USD",
                available: priceData.count || 0,
              };
            }
          }
        }
      }

      return prices;
    }

    return {};
  }

  /**
   * 获取激活号码 (V2版本API) - 原始方法
   */
  async getNumberV2(
    service,
    country = 0,
    operator = null,
    maxPrice = null,
    orderId = null,
    options = {}
  ) {
    // 检查API密钥
    if (!this.apiKey) {
      throw new Error("SMS Activate API密钥未配置");
    }

    const params = {
      api_key: this.apiKey,
      action: "getNumberV2",
      service,
      country,
    };

    // 添加可选参数
    if (operator && operator !== "any") {
      params.operator = operator;
    }

    if (maxPrice !== null) {
      params.maxPrice = maxPrice;
    }

    if (orderId) {
      params.orderId = orderId;
    }

    // 添加高级选项
    if (options.forward) {
      params.forward = options.forward;
    }

    if (options.activationType) {
      params.activationType = options.activationType;
    }

    if (options.language) {
      params.language = options.language;
    }

    if (options.userId) {
      params.userId = options.userId;
    }

    if (options.webhook_url) {
      params.url = options.webhook_url;
    }

    try {
      const result = await this.makeRequest(params);

      logger.info("getNumberV2 API响应:", result);

      // 解析响应 - SMS-Activate V2 API 返回JSON格式
      if (typeof result === "object" && result.activationId) {
        return {
          success: true,
          id: result.activationId,
          number: result.phoneNumber,
          activationCost: result.activationCost,
          activationTime: result.activationTime,
          discount: result.discount,
          countryCode: result.countryCode,
        };
      }

      // 处理字符串响应格式 (如果API返回旧格式)
      if (typeof result === "string" && result.includes(":")) {
        const parts = result.split(":");
        if (parts.length >= 2) {
          return {
            success: true,
            id: parts[1],
            number: parts[2] || parts[1],
            activationCost: null,
            activationTime: null,
            discount: null,
            countryCode: country,
          };
        }
      }

      throw new Error("获取号码V2失败：响应格式无效");
    } catch (error) {
      logger.error("获取号码V2失败:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 购买激活号码 (使用 getNumberV2)
   */
  async purchaseActivation(
    service,
    country = 0,
    operator = null,
    maxPrice = null,
    orderId = null,
    options = {}
  ) {
    // 检查API密钥
    if (!this.apiKey) {
      throw new Error("SMS Activate API密钥未配置");
    }

    const {
      forward = 0, // 是否需要转发 (0=否, 1=是)
      ref = null, // 推荐ID
      phoneException = null, // 排除的号码前缀
      activationType = 0, // 激活类型 (0=SMS, 1=号码, 2=语音)
      language = "en", // 语言
      userId = this.userId,
    } = options;

    const params = {
      api_key: this.apiKey,
      action: "getNumberV2",
      service: service,
      country: country,
      forward: forward,
      activationType: activationType,
      language: language,
      userId: userId,
    };

    if (operator && operator !== "any") {
      params.operator = operator;
    }

    // 添加 FreePrice 支持
    if (maxPrice && maxPrice > 0) {
      params.maxPrice = maxPrice;
    }

    // 添加订单ID用于幂等性
    if (orderId) {
      params.orderId = orderId;
    }

    // 添加可选参数
    if (ref) {
      params.ref = ref;
    }

    if (phoneException) {
      params.phoneException = phoneException;
    }

    logger.info("购买激活号码参数 (V2):", {
      service,
      country,
      operator,
      maxPrice,
      orderId,
      params,
    });

    try {
      const result = await this.makeRequest(params, "POST");

      logger.info("SMS Activate API响应 (V2):", {
        result,
        type: typeof result,
      });

      // V2 返回格式: JSON对象
      if (typeof result === "object" && result.activationId && result.phoneNumber) {
        return {
          id: result.activationId.toString(),
          number: result.phoneNumber,
          service,
          country,
          cost: result.activationCost,
          currency: result.currency,
          countryCode: result.countryCode,
          canGetAnotherSms: result.canGetAnotherSms === "1",
          activationTime: result.activationTime,
          operator: result.activationOperator,
        };
      }

      // 检查是否是错误响应 - 支持字符串和JSON格式
      if (typeof result === "string" && this.errorCodes[result]) {
        throw new Error(this.errorCodes[result]);
      }

      // 检查JSON格式的错误响应
      if (typeof result === "object" && result.result && this.errorCodes[result.result]) {
        throw new Error(this.errorCodes[result.result]);
      }

      // 如果是其他格式的响应，记录并抛出错误
      logger.error("意外的API响应格式 (V2):", { result, type: typeof result });
      throw new Error(`购买激活号码失败: 意外的响应格式 - ${JSON.stringify(result)}`);
    } catch (error) {
      logger.error("购买激活号码失败 (V2):", { error: error.message, params });
      throw error;
    }
  }

  /**
   * 将SMS-Activate API状态映射到本地状态码
   */
  mapApiStatusToLocalStatus(apiStatus) {
    const statusMap = {
      STATUS_WAIT_CODE: "0", // 等待短信
      STATUS_WAIT_RETRY: "1", // 等待重试
      STATUS_OK: "3", // 已收到短信
      STATUS_CANCEL: "6", // 已取消
      STATUS_FINISH: "8", // 激活完成
    };

    return statusMap[apiStatus] || apiStatus;
  }

  /**
   * 检查激活状态
   */
  async checkActivationStatus(activationId) {
    const result = await this.makeRequest({
      api_key: this.apiKey,
      action: "getStatus",
      id: activationId,
    });

    // 返回格式: "STATUS_WAIT_CODE" 或 "STATUS_OK:code"
    if (typeof result === "string") {
      if (result.includes(":")) {
        const parts = result.split(":");
        const apiStatus = parts[0];
        const code = parts[1] || null;

        return {
          status: this.mapApiStatusToLocalStatus(apiStatus),
          code: code,
        };
      } else {
        return {
          status: this.mapApiStatusToLocalStatus(result),
          code: null,
        };
      }
    }

    throw new Error("检查激活状态失败");
  }

  /**
   * 获取激活状态（别名方法，兼容性）
   */
  async getStatus(activationId) {
    return this.checkActivationStatus(activationId);
  }

  /**
   * 设置激活状态
   */
  async setActivationStatus(activationId, status) {
    // 将本地状态码映射到SMS-Activate API状态码
    const statusMap = {
      1: 3, // 等待重试 -> request one more code
      3: 6, // 已收到短信 -> finish activation
      6: 8, // 已取消 -> cancel activation
      8: 6, // 激活完成 -> finish activation
    };

    const apiStatus = statusMap[status] || status;

    const result = await this.makeRequest(
      {
        api_key: this.apiKey,
        action: "setStatus",
        id: activationId,
        status: apiStatus,
      },
      "POST"
    );

    return result;
  }

  /**
   * 取消激活
   */
  async cancelActivation(activationId) {
    return await this.setActivationStatus(activationId, "6"); // 6 -> 8 (cancel)
  }

  /**
   * 确认激活完成
   */
  async confirmActivation(activationId) {
    return await this.setActivationStatus(activationId, "8"); // 8 -> 6 (finish)
  }

  /**
   * 请求重发短信
   */
  async requestRetry(activationId) {
    return await this.setActivationStatus(activationId, "1"); // 1 -> 3 (retry)
  }

  /**
   * 使用 FreePrice 购买激活号码
   */
  async purchaseActivationWithFreePrice(
    service,
    country = 0,
    operator = null,
    maxPrice,
    orderId = null,
    options = {}
  ) {
    if (!maxPrice || maxPrice <= 0) {
      throw new Error("FreePrice 模式下必须指定最大价格");
    }

    return await this.purchaseActivation(service, country, operator, maxPrice, orderId, options);
  }

  /**
   * 租用手机号码
   */
  async rentPhoneNumber(service, time = 4, country = 0, operator = "any") {
    const params = {
      api_key: this.apiKey,
      action: "getRentNumber",
      service: service,
      rent_time: time,
      country: country,
      operator: operator,
    };

    const result = await this.makeRequest(params, "POST");

    if (typeof result === "object" && result.phone) {
      return {
        id: result.id,
        phone: result.phone,
        service,
        country,
        time,
        endTime: result.endTime,
      };
    }

    throw new Error("租用手机号码失败");
  }

  /**
   * 检查租用状态
   */
  async checkRentalStatus(rentalId) {
    const result = await this.makeRequest(
      {
        api_key: this.apiKey,
        action: "getRentStatus",
        id: rentalId,
      },
      "POST"
    );

    return result;
  }

  /**
   * 取消租用
   */
  async cancelRental(rentalId) {
    const result = await this.makeRequest(
      {
        api_key: this.apiKey,
        action: "setRentStatus",
        id: rentalId,
        status: "cancel",
      },
      "POST"
    );

    return result;
  }

  /**
   * 获取国家代码
   */
  getCountryCode(countryId) {
    const codes = {
      0: "RU",
      1: "UA",
      2: "KZ",
      3: "CN",
      4: "PH",
      5: "MM",
      6: "ID",
      7: "MY",
      8: "KE",
      9: "TZ",
      10: "VN",
      11: "KG",
      12: "US",
      13: "IL",
      14: "HK",
      15: "PL",
      16: "GB",
      17: "MG",
      18: "CG",
      19: "NG",
      20: "MO",
      21: "EG",
      22: "IN",
      23: "IE",
      24: "KH",
      25: "LA",
      26: "HT",
      27: "CI",
      28: "GM",
      29: "RS",
      30: "YE",
      31: "ZA",
      32: "RO",
      33: "CO",
      34: "EE",
      35: "AZ",
      36: "CA",
      37: "MA",
      38: "GH",
      39: "AR",
      40: "UZ",
      41: "CM",
      42: "TD",
      43: "DE",
      44: "LT",
      45: "HR",
      46: "SE",
      47: "IQ",
      48: "NL",
      49: "LV",
      50: "AT",
      51: "BY",
      52: "TH",
      53: "SA",
      54: "MX",
      55: "TW",
      56: "ES",
      57: "IR",
      58: "DZ",
      59: "SI",
      60: "BD",
      61: "SN",
      62: "TR",
      63: "CZ",
      64: "LK",
      65: "PE",
      66: "PK",
      67: "NZ",
      68: "GN",
      69: "ML",
      70: "VE",
    };
    return codes[countryId] || "XX";
  }

  /**
   * 获取服务中文名称
   */
  getServiceName(serviceKey) {
    return this.serviceNames[serviceKey] || serviceKey;
  }

  /**
   * 获取国家中文名称
   */
  getCountryName(countryId) {
    return this.countryNames[countryId] || `国家${countryId}`;
  }

  /**
   * 获取可用的租用服务和国家
   * @param {number} time - 租用时间（默认4小时）
   * @param {string} operator - 运营商（默认"any"）
   * @param {number} country - 国家ID（默认0，俄罗斯）
   * @param {boolean} incomingCall - 是否支持来电
   * @param {string} currency - 货币代码（默认"840"，美元）
   * @returns {Promise<Object>} 可用的服务、国家和运营商信息
   */
  async getRentServicesAndCountries(
    time = 4,
    operator = "any",
    country = 0,
    incomingCall = false,
    currency = "840"
  ) {
    const params = {
      api_key: this.apiKey,
      action: "getRentServicesAndCountries",
      rent_time: time,
      operator: operator,
      country: country,
      incomingCall: incomingCall ? "true" : "false",
      currency: currency,
    };

    try {
      const result = await this.makeRequest(params, "GET");

      // 处理API响应
      if (result && typeof result === "object") {
        return {
          success: true,
          countries: result.countries || {},
          operators: result.operators || {},
          services: result.services || {},
          currency: result.currency || "840",
        };
      }

      throw new Error("获取租用服务信息失败");
    } catch (error) {
      logger.error("获取租用服务信息失败:", error);
      throw error;
    }
  }

  /**
   * 获取租用号码
   * @param {string} service - 服务名称
   * @param {number} time - 租用时间（小时）
   * @param {string} operator - 运营商
   * @param {number} country - 国家ID
   * @param {string} url - webhook URL
   * @param {boolean} incomingCall - 是否支持来电
   * @returns {Promise<Object>} 租用结果
   */
  async getRentNumber(
    service,
    time = 4,
    operator = "any",
    country = 0,
    url = "",
    incomingCall = false
  ) {
    const params = {
      api_key: this.apiKey,
      action: "getRentNumber",
      service: service,
      rent_time: time,
      operator: operator,
      country: country,
      url: url,
      incomingCall: incomingCall ? "true" : "false",
    };

    try {
      const result = await this.makeRequest(params, "POST");

      if (result && result.status === "success" && result.phone) {
        return {
          success: true,
          id: result.phone.id,
          phone: result.phone.number,
          endDate: result.phone.endDate,
          service: service,
          country: country,
          time: time,
        };
      }

      throw new Error(result?.message || "租用号码失败");
    } catch (error) {
      logger.error("租用号码失败:", error);
      throw error;
    }
  }

  /**
   * 获取租用状态
   * @param {string} id - 租用ID
   * @param {number} page - 页码（默认1）
   * @param {number} size - 页面大小（默认10）
   * @returns {Promise<Object>} 租用状态信息
   */
  async getRentStatus(id, page = 1, size = 10) {
    const params = {
      api_key: this.apiKey,
      action: "getRentStatus",
      id: id,
      page: page,
      size: size,
    };

    try {
      const result = await this.makeRequest(params, "POST");

      if (result && result.status === "success") {
        return {
          success: true,
          quantity: result.quantity || "0",
          values: result.values || {},
        };
      }

      throw new Error(result?.message || "获取租用状态失败");
    } catch (error) {
      logger.error("获取租用状态失败:", error);
      throw error;
    }
  }

  /**
   * 设置租用状态
   * @param {string} id - 租用ID
   * @param {number} status - 状态码（1=完成，2=取消）
   * @returns {Promise<Object>} 操作结果
   */
  async setRentStatus(id, status) {
    const params = {
      api_key: this.apiKey,
      action: "setRentStatus",
      id: id,
      status: status,
    };

    try {
      const result = await this.makeRequest(params, "POST");

      if (result && result.status === "success") {
        return {
          success: true,
          message: "状态更新成功",
        };
      }

      throw new Error(result?.message || "状态更新失败");
    } catch (error) {
      logger.error("设置租用状态失败:", error);
      throw error;
    }
  }

  /**
   * 获取租用列表
   * @param {number} length - 页面大小（默认10）
   * @param {number} page - 页码（默认1）
   * @returns {Promise<Object>} 租用列表
   */
  async getRentList(length = 10, page = 1) {
    const params = {
      api_key: this.apiKey,
      action: "getRentList",
      length: length,
      page: page,
    };

    try {
      const result = await this.makeRequest(params, "POST");

      if (result && result.status === "success") {
        return {
          success: true,
          values: result.values || {},
        };
      }

      throw new Error(result?.message || "获取租用列表失败");
    } catch (error) {
      logger.error("获取租用列表失败:", error);
      throw error;
    }
  }

  /**
   * 延长租用时间
   * @param {string} id - 租用ID
   * @param {number} time - 延长时间（小时）
   * @returns {Promise<Object>} 延长结果
   */
  async continueRentNumber(id, time = 4) {
    const params = {
      api_key: this.apiKey,
      action: "continueRentNumber",
      id: id,
      rent_time: time,
    };

    try {
      const result = await this.makeRequest(params, "POST");

      if (result && result.status === "success" && result.phone) {
        return {
          success: true,
          id: result.phone.id,
          phone: result.phone.number,
          endDate: result.phone.endDate,
        };
      }

      throw new Error(result?.message || "延长租用失败");
    } catch (error) {
      logger.error("延长租用失败:", error);
      throw error;
    }
  }

  /**
   * 获取延长租用信息
   * @param {string} id - 租用ID
   * @param {number} hours - 延长时间
   * @param {boolean} needHistory - 是否需要历史记录
   * @returns {Promise<Object>} 延长信息
   */
  async continueRentInfo(id, hours, needHistory = false) {
    const params = {
      api_key: this.apiKey,
      action: "continueRentInfo",
      id: id,
      hours: hours,
      needHistory: needHistory ? "true" : "false",
    };

    try {
      const result = await this.makeRequest(params, "POST");

      if (result && result.status === "success") {
        return {
          success: true,
          price: result.price,
          currency: result.currency,
          hours: result.hours,
          history: result.history || {},
        };
      }

      throw new Error(result?.message || "获取延长信息失败");
    } catch (error) {
      logger.error("获取延长租用信息失败:", error);
      throw error;
    }
  }

  /**
   * 测试API连接和密钥有效性
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          message: "API密钥未配置",
          details: "请在环境变量中设置 SMS_ACTIVATE_API_KEY",
        };
      }

      // 尝试获取账户余额来测试连接
      const balance = await this.getBalance();

      return {
        success: true,
        message: "API连接正常",
        balance: balance,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("API连接测试失败:", error);
      return {
        success: false,
        message: "API连接失败",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 获取API健康状态和统计信息
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
        apiUrl: this.baseURL,
        apiKeyConfigured: !!this.apiKey,
        requestCount: this.requestCount,
        lastRequestTime: this.lastRequestTime ? new Date(this.lastRequestTime).toISOString() : null,
        uptime: process.uptime(),
        nodeVersion: process.version,
        ...connectionTest,
      };

      if (connectionTest.success) {
        // 获取额外的服务信息
        try {
          const operators = await this.getOperators();
          healthData.operatorsAvailable = Array.isArray(operators) ? operators.length : 0;
        } catch (error) {
          healthData.operatorsError = error.message;
        }
      }

      return healthData;
    } catch (error) {
      logger.error("获取健康状态失败:", error);
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        message: error.message,
        apiUrl: this.baseURL,
        apiKeyConfigured: !!this.apiKey,
      };
    }
  }

  /**
   * 验证API密钥权限
   */
  async validateApiPermissions() {
    const permissions = {
      getBalance: false,
      getServices: false,
      getOperators: false,
      getPrices: false,
      purchaseActivation: false,
      rentNumbers: false,
    };

    const results = {
      valid: false,
      permissions,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    if (!this.apiKey) {
      results.errors.push("API密钥未配置");
      return results;
    }

    // 测试各种权限
    try {
      await this.getBalance();
      permissions.getBalance = true;
    } catch (error) {
      results.errors.push(`获取余额权限: ${error.message}`);
    }

    try {
      await this.getServices();
      permissions.getServices = true;
    } catch (error) {
      results.errors.push(`获取服务权限: ${error.message}`);
    }

    try {
      await this.getOperators();
      permissions.getOperators = true;
    } catch (error) {
      results.errors.push(`获取运营商权限: ${error.message}`);
    }

    try {
      await this.getPrices();
      permissions.getPrices = true;
    } catch (error) {
      results.errors.push(`获取价格权限: ${error.message}`);
    }

    // 检查是否有基本权限
    const basicPermissions = [
      permissions.getBalance,
      permissions.getServices,
      permissions.getOperators,
      permissions.getPrices,
    ];

    results.valid = basicPermissions.filter(Boolean).length >= 3;

    return results;
  }

  /**
   * 清理和重置请求计数器
   */
  resetRequestCounter() {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    logger.info("SMS-Activate 请求计数器已重置");
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats() {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      apiKeyConfigured: !!this.apiKey,
      baseURL: this.baseURL,
      userId: this.userId,
      minRequestInterval: this.minRequestInterval,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = SMSActivateService;
