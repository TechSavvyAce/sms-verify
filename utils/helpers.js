const moment = require("moment");

/**
 * 格式化价格显示
 * @param {number} price - 价格
 * @param {string} currency - 货币符号
 * @returns {string} 格式化后的价格
 */
function formatPrice(price, currency = "$") {
  return `${currency}${parseFloat(price).toFixed(2)}`;
}

/**
 * 计算加价后的价格
 * @param {number} originalPrice - 原价
 * @param {number} markupPercent - 加价百分比
 * @returns {number} 加价后的价格
 */
function calculateMarkupPrice(originalPrice, markupPercent) {
  const markup = parseFloat(process.env.PRICE_MARKUP) || markupPercent || 20;
  return originalPrice * (1 + markup / 100);
}

/**
 * 生成唯一ID
 * @param {string} prefix - 前缀
 * @returns {string} 唯一ID
 */
function generateUniqueId(prefix = "") {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}${timestamp}${random}`;
}

/**
 * 格式化日期时间
 * @param {Date|string} date - 日期
 * @param {string} format - 格式
 * @returns {string} 格式化后的日期
 */
function formatDateTime(date, format = "YYYY-MM-DD HH:mm:ss") {
  return moment(date).format(format);
}

/**
 * 计算时间差
 * @param {Date|string} startDate - 开始时间
 * @param {Date|string} endDate - 结束时间
 * @returns {object} 时间差对象
 */
function getTimeDifference(startDate, endDate = new Date()) {
  const start = moment(startDate);
  const end = moment(endDate);
  const duration = moment.duration(end.diff(start));

  return {
    years: duration.years(),
    months: duration.months(),
    days: duration.days(),
    hours: duration.hours(),
    minutes: duration.minutes(),
    seconds: duration.seconds(),
    humanize: duration.humanize(),
  };
}

/**
 * 验证手机号格式
 * @param {string} phone - 手机号
 * @returns {boolean} 是否有效
 */
function isValidPhone(phone) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 生成随机字符串
 * @param {number} length - 长度
 * @param {string} chars - 字符集
 * @returns {string} 随机字符串
 */
function generateRandomString(
  length = 8,
  chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise对象
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全的 JSON 解析
 * @param {string} str - JSON 字符串
 * @param {any} defaultValue - 默认值
 * @returns {any} 解析结果
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 分页参数处理
 * @param {number} page - 页码
 * @param {number} limit - 每页数量
 * @returns {object} 分页参数
 */
function getPaginationParams(page = 1, limit = 10) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  return {
    page: pageNum,
    limit: limitNum,
    offset,
  };
}

/**
 * 构建分页响应
 * @param {Array} data - 数据
 * @param {number} total - 总数
 * @param {number} page - 当前页
 * @param {number} limit - 每页数量
 * @returns {object} 分页响应
 */
function buildPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * 检查OneTimePing支付状态
 * @param {string} paymentId - 支付ID
 * @returns {Promise<Object>} 支付状态信息
 */
async function checkPaymentStatus(paymentId) {
  try {
    const response = await fetch(
      `https://www.onetimeping.eu/api/payment/status?payment_id=${paymentId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SAFEPING_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`OneTimePing API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error(`检查支付状态失败: ${paymentId}`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  formatPrice,
  calculateMarkupPrice,
  generateUniqueId,
  formatDateTime,
  getTimeDifference,
  isValidPhone,
  isValidEmail,
  generateRandomString,
  delay,
  safeJsonParse,
  getPaginationParams,
  buildPaginatedResponse,
  checkPaymentStatus,
};
