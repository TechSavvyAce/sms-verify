/**
 * 格式化日期时间
 * @param date 日期字符串或Date对象
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (date: string | Date): string => {
  if (!date) return "N/A";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    return "Invalid Date";
  }
};

/**
 * 格式化日期
 * @param date 日期字符串或Date对象
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: string | Date): string => {
  if (!date) return "N/A";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch (error) {
    return "Invalid Date";
  }
};

/**
 * 格式化金额
 * @param amount 金额
 * @param currency 货币符号
 * @returns 格式化后的金额字符串
 */
export const formatCurrency = (amount: number, currency: string = "¥"): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }

  return `${currency}${Math.abs(amount).toFixed(2)}`;
};

/**
 * 获取相对时间描述
 * @param date 日期字符串或Date对象
 * @returns 相对时间描述
 */
export const getRelativeTime = (date: string | Date): string => {
  if (!date) return "N/A";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "刚刚";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}分钟前`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}小时前`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}天前`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months}个月前`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years}年前`;
    }
  } catch (error) {
    return "Invalid Date";
  }
};

/**
 * 截断文本
 * @param text 文本
 * @param maxLength 最大长度
 * @returns 截断后的文本
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + "...";
};

/**
 * 生成随机ID
 * @param length ID长度
 * @returns 随机ID字符串
 */
export const generateRandomId = (length: number = 8): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

/**
 * 检测输入类型（用户名、邮箱或手机号）
 */
export const detectInputType = (input: string): "username" | "email" | "phone" => {
  // 检测邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(input)) {
    return "email";
  }

  // 检测手机号格式（中国大陆）
  const phoneRegex = /^(\+86)?1[3-9]\d{9}$/;
  if (phoneRegex.test(input)) {
    return "phone";
  }

  // 默认为用户名
  return "username";
};

/**
 * 验证输入格式
 */
export const validateInput = (input: string): { isValid: boolean; message: string } => {
  const inputType = detectInputType(input);

  switch (inputType) {
    case "email":
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        return { isValid: false, message: "请输入有效的邮箱地址" };
      }
      break;

    case "phone":
      const phoneRegex = /^(\+86)?1[3-9]\d{9}$/;
      if (!phoneRegex.test(input)) {
        return { isValid: false, message: "请输入有效的中国大陆手机号码" };
      }
      break;

    case "username":
      if (input.length < 3) {
        return { isValid: false, message: "用户名至少3个字符" };
      }
      if (input.length > 30) {
        return { isValid: false, message: "用户名最多30个字符" };
      }
      if (!/^[a-zA-Z0-9_]+$/.test(input)) {
        return { isValid: false, message: "用户名只能包含字母、数字和下划线" };
      }
      break;
  }

  return { isValid: true, message: "" };
};

/**
 * 获取输入字段的占位符文本
 */
export const getInputPlaceholder = (inputType: "username" | "email" | "phone"): string => {
  switch (inputType) {
    case "email":
      return "邮箱地址";
    case "phone":
      return "手机号码";
    case "username":
    default:
      return "用户名、邮箱或手机号";
  }
};

/**
 * 获取输入字段的图标
 */
export const getInputIcon = (inputType: "username" | "email" | "phone") => {
  switch (inputType) {
    case "email":
      return "mail";
    case "phone":
      return "mobile";
    case "username":
    default:
      return "user";
  }
};
