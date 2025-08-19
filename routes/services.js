const express = require("express");
const SMSActivateService = require("../services/SMSActivateService");
const { optionalAuth } = require("../middleware/auth");
const { validateSearch, createValidationMiddleware } = require("../middleware/validation");
const logger = require("../utils/logger");
const router = express.Router();

const smsService = new SMSActivateService();

/**
 * 获取服务列表
 * GET /api/services
 */
router.get(
  "/",
  optionalAuth,
  createValidationMiddleware(validateSearch, "query"),
  async (req, res) => {
    try {
      const { q: searchQuery, category } = req.query;

      // 获取服务列表
      const services = await smsService.getServices();

      // 过滤搜索结果
      let filteredServices = services;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredServices = services.filter(
          (service) =>
            service.name.toLowerCase().includes(query) || service.key.toLowerCase().includes(query)
        );
      }

      if (category) {
        // 根据分类过滤（可以扩展分类逻辑）
        const categoryServices = {
          social: ["whatsapp", "telegram", "instagram", "facebook", "twitter", "wechat", "qq"],
          messaging: ["whatsapp", "telegram", "viber", "wechat", "qq"],
          ecommerce: ["taobao", "jd", "amazon", "alibaba"],
          finance: ["alipay", "paypal", "stripe"],
          popular: ["whatsapp", "telegram", "instagram", "wechat", "qq", "google"],
        };

        if (categoryServices[category]) {
          filteredServices = filteredServices.filter((service) =>
            categoryServices[category].includes(service.key)
          );
        }
      }

      // 按受欢迎程度和可用性排序
      filteredServices.sort((a, b) => {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return b.available - a.available;
      });

      res.json({
        success: true,
        data: {
          services: filteredServices,
          total: filteredServices.length,
          categories: {
            all: "全部服务",
            popular: "热门服务",
            social: "社交平台",
            messaging: "即时通讯",
            ecommerce: "电商平台",
            finance: "金融支付",
          },
        },
      });
    } catch (error) {
      logger.error("获取服务列表失败:", error);
      res.status(500).json({
        success: false,
        error: "获取服务列表失败",
      });
    }
  }
);

/**
 * 获取指定服务的国家列表
 * GET /api/services/:service/countries
 */
router.get("/:service/countries", optionalAuth, async (req, res) => {
  try {
    const { service } = req.params;

    // 获取国家列表
    const countries = await smsService.getCountriesForService(service);

    // 添加推荐国家标记
    const recommendedCountries = [0, 3, 12, 14, 55]; // 俄国、中国、美国、香港、台湾

    const enhancedCountries = countries.map((country) => ({
      ...country,
      recommended: recommendedCountries.includes(country.id),
      flag: getCountryFlag(country.code),
    }));

    // 按推荐程度和可用性排序
    enhancedCountries.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return b.available - a.available;
    });

    res.json({
      success: true,
      data: {
        service: service,
        service_name: smsService.getServiceName(service),
        countries: enhancedCountries,
        total: enhancedCountries.length,
      },
    });
  } catch (error) {
    logger.error("获取国家列表失败:", error);
    res.status(500).json({
      success: false,
      error: "获取国家列表失败",
    });
  }
});

/**
 * 获取价格信息
 * GET /api/services/pricing
 */
router.get("/pricing", optionalAuth, async (req, res) => {
  try {
    const { service, country } = req.query;

    // 获取价格信息
    const pricing = await smsService.getPrices(service, country);

    // 格式化价格数据
    const formattedPricing = {};

    for (const [countryId, services] of Object.entries(pricing)) {
      const countryName = smsService.getCountryName(parseInt(countryId));

      formattedPricing[countryId] = {
        country_id: parseInt(countryId),
        country_name: countryName,
        services: {},
      };

      for (const [serviceKey, priceData] of Object.entries(services)) {
        formattedPricing[countryId].services[serviceKey] = {
          service_key: serviceKey,
          service_name: smsService.getServiceName(serviceKey),
          price: {
            original: priceData.original,
            final: priceData.markup,
            currency: "CNY",
            markup_percent: Math.round(
              ((priceData.markup - priceData.original) / priceData.original) * 100
            ),
          },
          available: priceData.available,
          recommended: isRecommendedService(serviceKey),
        };
      }
    }

    res.json({
      success: true,
      data: {
        pricing: formattedPricing,
        updated_at: new Date().toISOString(),
        currency: "CNY",
      },
    });
  } catch (error) {
    logger.error("获取价格信息失败:", error);
    res.status(500).json({
      success: false,
      error: "获取价格信息失败",
    });
  }
});

/**
 * 获取服务详情
 * GET /api/services/:service
 */
router.get("/:service", optionalAuth, async (req, res) => {
  try {
    const { service } = req.params;

    // 获取服务的国家和价格信息
    const [countries, pricing] = await Promise.all([
      smsService.getCountriesForService(service),
      smsService.getPrices(service),
    ]);

    // 计算统计信息
    const totalCountries = countries.length;
    const totalAvailable = countries.reduce((sum, country) => sum + country.available, 0);
    const avgPrice = calculateAveragePrice(pricing, service);

    // 获取服务详情
    const serviceInfo = {
      key: service,
      name: smsService.getServiceName(service),
      description: getServiceDescription(service),
      category: getServiceCategory(service),
      popular: isRecommendedService(service),
      stats: {
        total_countries: totalCountries,
        total_available: totalAvailable,
        average_price: avgPrice,
        success_rate: getServiceSuccessRate(service),
      },
      features: getServiceFeatures(service),
      supported_countries: countries.slice(0, 10), // 返回前10个国家
      pricing_sample: getSamplePricing(pricing, service),
    };

    res.json({
      success: true,
      data: serviceInfo,
    });
  } catch (error) {
    logger.error("获取服务详情失败:", error);
    res.status(500).json({
      success: false,
      error: "获取服务详情失败",
    });
  }
});

/**
 * 搜索服务
 * POST /api/services/search
 */
router.post("/search", optionalAuth, async (req, res) => {
  try {
    const { query, filters = {} } = req.body;

    // 获取所有服务
    const allServices = await smsService.getServices();

    let results = allServices;

    // 文本搜索
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(
        (service) =>
          service.name.toLowerCase().includes(searchTerm) ||
          service.key.toLowerCase().includes(searchTerm) ||
          getServiceDescription(service.key).toLowerCase().includes(searchTerm)
      );
    }

    // 应用过滤器
    if (filters.category) {
      results = results.filter((service) => getServiceCategory(service.key) === filters.category);
    }

    if (filters.min_available) {
      results = results.filter((service) => service.available >= filters.min_available);
    }

    if (filters.popular_only) {
      results = results.filter((service) => service.popular);
    }

    // 排序
    const sortBy = filters.sort || "popularity";
    results.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name, "zh-CN");
        case "available":
          return b.available - a.available;
        case "popularity":
        default:
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return b.available - a.available;
      }
    });

    res.json({
      success: true,
      data: {
        query,
        filters,
        results,
        total: results.length,
      },
    });
  } catch (error) {
    logger.error("搜索服务失败:", error);
    res.status(500).json({
      success: false,
      error: "搜索服务失败",
    });
  }
});

/**
 * 获取国家旗帜表情符号
 */
function getCountryFlag(countryCode) {
  const flagMap = {
    RU: "🇷🇺",
    UA: "🇺🇦",
    KZ: "🇰🇿",
    CN: "🇨🇳",
    PH: "🇵🇭",
    MM: "🇲🇲",
    ID: "🇮🇩",
    MY: "🇲🇾",
    KE: "🇰🇪",
    TZ: "🇹🇿",
    VN: "🇻🇳",
    KG: "🇰🇬",
    US: "🇺🇸",
    IL: "🇮🇱",
    HK: "🇭🇰",
    PL: "🇵🇱",
    GB: "🇬🇧",
    MG: "🇲🇬",
    CG: "🇨🇬",
    NG: "🇳🇬",
    MO: "🇲🇴",
    EG: "🇪🇬",
    IN: "🇮🇳",
    IE: "🇮🇪",
    KH: "🇰🇭",
    LA: "🇱🇦",
    HT: "🇭🇹",
    CI: "🇨🇮",
    GM: "🇬🇲",
    RS: "🇷🇸",
    YE: "🇾🇪",
    ZA: "🇿🇦",
    RO: "🇷🇴",
    CO: "🇨🇴",
    EE: "🇪🇪",
    AZ: "🇦🇿",
    CA: "🇨🇦",
    MA: "🇲🇦",
    GH: "🇬🇭",
    AR: "🇦🇷",
    UZ: "🇺🇿",
    CM: "🇨🇲",
    TD: "🇹🇩",
    DE: "🇩🇪",
    LT: "🇱🇹",
    HR: "🇭🇷",
    SE: "🇸🇪",
    IQ: "🇮🇶",
    NL: "🇳🇱",
    LV: "🇱🇻",
    AT: "🇦🇹",
    BY: "🇧🇾",
    TH: "🇹🇭",
    SA: "🇸🇦",
    MX: "🇲🇽",
    TW: "🇹🇼",
    ES: "🇪🇸",
    IR: "🇮🇷",
    DZ: "🇩🇿",
    SI: "🇸🇮",
    BD: "🇧🇩",
    SN: "🇸🇳",
    TR: "🇹🇷",
    CZ: "🇨🇿",
    LK: "🇱🇰",
    PE: "🇵🇪",
    PK: "🇵🇰",
    NZ: "🇳🇿",
    GN: "🇬🇳",
    ML: "🇲🇱",
    VE: "🇻🇪",
  };
  return flagMap[countryCode] || "🏳️";
}

/**
 * 判断是否为推荐服务
 */
function isRecommendedService(serviceKey) {
  const recommendedServices = [
    "whatsapp",
    "telegram",
    "instagram",
    "wechat",
    "qq",
    "google",
    "facebook",
    "twitter",
    "alipay",
    "taobao",
  ];
  return recommendedServices.includes(serviceKey);
}

/**
 * 获取服务描述
 */
function getServiceDescription(serviceKey) {
  const descriptions = {
    whatsapp: "全球最受欢迎的即时通讯应用",
    telegram: "安全、快速的即时通讯应用",
    instagram: "流行的图片社交平台",
    wechat: "中国最大的社交平台",
    qq: "腾讯旗下的即时通讯软件",
    google: "谷歌账户注册",
    facebook: "全球最大的社交网络",
    twitter: "微博社交平台",
    alipay: "支付宝账户注册",
    taobao: "淘宝购物平台",
  };
  return descriptions[serviceKey] || `${serviceKey} 服务激活`;
}

/**
 * 获取服务分类
 */
function getServiceCategory(serviceKey) {
  const categories = {
    whatsapp: "messaging",
    telegram: "messaging",
    viber: "messaging",
    wechat: "social",
    qq: "social",
    instagram: "social",
    facebook: "social",
    twitter: "social",
    google: "tech",
    microsoft: "tech",
    apple: "tech",
    alipay: "finance",
    taobao: "ecommerce",
    jd: "ecommerce",
    amazon: "ecommerce",
  };
  return categories[serviceKey] || "other";
}

/**
 * 获取服务功能特点
 */
function getServiceFeatures(serviceKey) {
  const features = {
    whatsapp: ["即时消息", "语音通话", "视频通话", "文件分享"],
    telegram: ["端到端加密", "大型群组", "机器人支持", "云同步"],
    instagram: ["图片分享", "故事功能", "IGTV", "直播"],
    wechat: ["支付功能", "小程序", "朋友圈", "企业服务"],
    qq: ["多人聊天", "游戏平台", "空间动态", "音乐分享"],
  };
  return features[serviceKey] || ["短信接收", "账户激活"];
}

/**
 * 获取服务成功率
 */
function getServiceSuccessRate(serviceKey) {
  // 这里可以从数据库获取实际的成功率数据
  const successRates = {
    whatsapp: 95,
    telegram: 98,
    instagram: 92,
    wechat: 90,
    qq: 93,
    google: 94,
    facebook: 89,
    twitter: 91,
  };
  return successRates[serviceKey] || 88;
}

/**
 * 计算平均价格
 */
function calculateAveragePrice(pricing, service) {
  let totalPrice = 0;
  let count = 0;

  for (const countryServices of Object.values(pricing)) {
    if (countryServices[service]) {
      totalPrice += countryServices[service].markup;
      count++;
    }
  }

  return count > 0 ? (totalPrice / count).toFixed(2) : 0;
}

/**
 * 获取价格样本
 */
function getSamplePricing(pricing, service) {
  const samples = [];
  let count = 0;

  for (const [countryId, services] of Object.entries(pricing)) {
    if (count >= 5) break; // 只返回5个样本

    if (services[service]) {
      samples.push({
        country_id: parseInt(countryId),
        country_name: smsService.getCountryName(parseInt(countryId)),
        price: services[service].markup,
        available: services[service].available,
      });
      count++;
    }
  }

  return samples;
}

module.exports = router;
