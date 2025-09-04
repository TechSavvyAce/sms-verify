const Joi = require("joi");
const { ValidationError } = require("./errorHandler");

/**
 * 通用验证规则
 */
const commonRules = {
  // 用户相关
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    "string.alphanum": "用户名只能包含字母和数字",
    "string.min": "用户名至少3个字符",
    "string.max": "用户名最多30个字符",
    "any.required": "用户名不能为空",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "请输入有效的邮箱地址",
    "any.required": "邮箱地址不能为空",
  }),

  password: Joi.string()
    .min(6)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      "string.min": "密码至少6个字符",
      "string.max": "密码最多100个字符",
      "string.pattern.base": "密码必须包含大小写字母和数字",
      "any.required": "密码不能为空",
    }),

  // 分页相关
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0),

  // ID相关
  id: Joi.number().integer().positive().required(),
  optionalId: Joi.number().integer().positive(),

  // 金额相关
  amount: Joi.number().positive().precision(2).required(),
  optionalAmount: Joi.number().positive().precision(2),

  // 服务相关
  service: Joi.string().required().messages({
    "any.required": "服务名称不能为空",
  }),

  country: Joi.number().integer().min(0).required(),
  operator: Joi.string().default("any"),

  // 状态相关
  status: Joi.string().valid("active", "inactive", "pending", "completed", "cancelled"),

  // 时间相关
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref("startDate")),
  }),

  // API Key相关
  apiKeyName: Joi.string().min(1).max(100).required(),
  permissions: Joi.array()
    .items(Joi.string().valid("read", "write", "admin"))
    .min(1)
    .required(),
};

/**
 * 用户注册验证
 */
const validateUserRegistration = Joi.object({
  username: commonRules.username,
  password: commonRules.password,
  email: commonRules.email.optional(), // 可选，后端会自动生成临时邮箱
});

/**
 * 用户登录验证
 */
const validateUserLogin = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false),
});

/**
 * 修改密码验证
 */
const validatePasswordChange = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "当前密码不能为空",
  }),
  newPassword: commonRules.password,
  confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "确认密码必须与新密码一致",
    "any.required": "确认密码不能为空",
  }),
});

/**
 * 用户资料更新验证
 */
const validateProfileUpdate = Joi.object({
  username: commonRules.username.optional(),
  email: commonRules.email.optional(),
  avatar: Joi.string().uri().optional(),
  preferences: Joi.object().optional(),
}).min(1);

/**
 * 激活购买验证
 */
const validateActivationPurchase = Joi.object({
  service: commonRules.service,
  country: commonRules.country,
  operator: commonRules.operator,
  maxPrice: commonRules.optionalAmount,
});

/**
 * 租用订单验证
 */
const validateRentalOrder = Joi.object({
  service: commonRules.service,
  country: commonRules.country,
  operator: commonRules.operator,
  time: Joi.number().integer().valid(4, 12, 24, 48, 72, 168).default(4),
  incomingCall: Joi.boolean().default(false),
  webhook_url: Joi.string().uri().optional(),
});

/**
 * 支付创建验证
 */
const validatePaymentCreation = Joi.object({
  service_name: Joi.string().required(),
  description: Joi.string().required(),
  amount: commonRules.amount,
  webhook_url: Joi.string().uri().optional(),
  language: Joi.string().valid("zh-CN", "en-US").default("zh-CN"),
});

/**
 * API密钥创建验证
 */
const validateApiKeyCreation = Joi.object({
  name: commonRules.apiKeyName,
  permissions: commonRules.permissions,
  expiresAt: Joi.date().iso().greater("now").optional(),
});

/**
 * 分页验证
 */
const validatePagination = Joi.object({
  page: commonRules.page,
  limit: commonRules.limit,
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

/**
 * 日期范围验证
 */
const validateDateRange = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  type: Joi.string().valid("recharge", "activation", "rental", "refund", "adjustment").optional(),
});

/**
 * 状态更新验证
 */
const validateStatusUpdate = Joi.object({
  id: commonRules.id,
  status: Joi.number().integer().valid(1, 3, 6, 8).required(),
});

/**
 * 邮箱验证码验证
 */
const validateEmailVerification = Joi.object({
  token: Joi.string().required().messages({
    "any.required": "验证码不能为空",
  }),
});

/**
 * 密码重置验证
 */
const validatePasswordReset = Joi.object({
  token: Joi.string().required(),
  password: commonRules.password,
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "确认密码必须与密码一致",
  }),
});

/**
 * Webhook配置验证
 */
const validateWebhookConfig = Joi.object({
  type: Joi.string().valid("rental", "payment", "activation").required(),
});

/**
 * Webhook测试验证
 */
const validateWebhookTest = Joi.object({
  url: Joi.string().uri().required(),
  payload: Joi.object().required(),
  secret: Joi.string().required(),
});

/**
 * 通知设置验证
 */
const validateNotificationSettings = Joi.object({
  email_login: Joi.boolean(),
  email_payment: Joi.boolean(),
  email_rental: Joi.boolean(),
  push_notifications: Joi.boolean(),
  sms_notifications: Joi.boolean(),
}).min(1);

/**
 * 搜索验证
 */
const validateSearch = Joi.object({
  query: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid("users", "transactions", "activations", "rentals").optional(),
  filters: Joi.object().optional(),
  ...validatePagination.describe().keys,
});

/**
 * 创建验证中间件
 */
const createValidationMiddleware = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      allowUnknown: false,
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type,
      }));

      return next(new ValidationError("请求参数验证失败", details));
    }

    // 将验证后的值赋回请求对象
    req[property] = value;
    next();
  };
};

/**
 * 批量验证中间件
 */
const validateMultiple = (validations) => {
  return (req, res, next) => {
    const errors = [];

    for (const { schema, property, required = true } of validations) {
      const data = req[property];

      // 如果不是必需的且数据为空，跳过验证
      if (!required && (!data || Object.keys(data).length === 0)) {
        continue;
      }

      const { error, value } = schema.validate(data, {
        allowUnknown: false,
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const details = error.details.map((detail) => ({
          property,
          field: detail.path.join("."),
          message: detail.message,
          value: detail.context?.value,
        }));
        errors.push(...details);
      } else {
        req[property] = value;
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError("请求参数验证失败", errors));
    }

    next();
  };
};

/**
 * 文件上传验证
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ["image/jpeg", "image/png", "image/gif"],
    maxSize = 5 * 1024 * 1024, // 5MB
    required = false,
  } = options;

  return (req, res, next) => {
    if (!req.file) {
      if (required) {
        return next(new ValidationError("文件不能为空"));
      }
      return next();
    }

    const { file } = req;

    // 检查文件类型
    if (!allowedTypes.includes(file.mimetype)) {
      return next(new ValidationError(`不支持的文件类型，仅支持: ${allowedTypes.join(", ")}`));
    }

    // 检查文件大小
    if (file.size > maxSize) {
      return next(
        new ValidationError(`文件大小超出限制，最大允许: ${Math.round(maxSize / 1024 / 1024)}MB`)
      );
    }

    next();
  };
};

/**
 * 动态验证规则生成器
 */
const createDynamicValidation = (rules) => {
  return (req, res, next) => {
    const schema = Joi.object(rules);
    const middleware = createValidationMiddleware(schema);
    middleware(req, res, next);
  };
};

module.exports = {
  // 预定义验证规则
  commonRules,

  // 验证 schemas
  validateUserRegistration,
  validateUserLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateActivationPurchase,
  validateRentalOrder,
  validatePaymentCreation,
  validateApiKeyCreation,
  validatePagination,
  validateDateRange,
  validateStatusUpdate,
  validateEmailVerification,
  validatePasswordReset,
  validateWebhookConfig,
  validateWebhookTest,
  validateNotificationSettings,
  validateSearch,

  // 中间件创建函数
  createValidationMiddleware,
  validateMultiple,
  validateFileUpload,
  createDynamicValidation,
};
