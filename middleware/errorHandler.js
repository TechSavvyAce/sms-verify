const logger = require("../utils/logger");

/**
 * 错误类型定义
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = "认证失败") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

class AuthorizationError extends AppError {
  constructor(message = "权限不足") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

class NotFoundError extends AppError {
  constructor(message = "资源不存在") {
    super(message, 404, "NOT_FOUND_ERROR");
  }
}

class ConflictError extends AppError {
  constructor(message = "资源冲突") {
    super(message, 409, "CONFLICT_ERROR");
  }
}

// DISABLED - Rate limiting removed
// class RateLimitError extends AppError {
//   constructor(message = "请求频率过高") {
//     super(message, 429, "RATE_LIMIT_ERROR");
//   }
// }

class ExternalServiceError extends AppError {
  constructor(message, service = null, originalError = null) {
    super(message, 502, "EXTERNAL_SERVICE_ERROR", {
      service,
      originalError: originalError?.message,
    });
  }
}

class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, "DATABASE_ERROR", {
      originalError: originalError?.message,
    });
  }
}

/**
 * 错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  logger.error("错误处理中间件捕获到错误:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
  });

  // Sequelize 验证错误
  if (err.name === "SequelizeValidationError") {
    const message = "数据验证失败";
    const details = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    error = new ValidationError(message, details);
  }

  // Sequelize 唯一约束错误
  if (err.name === "SequelizeUniqueConstraintError") {
    const message = "数据已存在";
    const details = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    error = new ConflictError(message);
  }

  // Sequelize 外键约束错误
  if (err.name === "SequelizeForeignKeyConstraintError") {
    const message = "关联数据不存在";
    error = new ValidationError(message);
  }

  // Sequelize 数据库连接错误
  if (err.name === "SequelizeConnectionError") {
    const message = "数据库连接失败";
    error = new DatabaseError(message, err);
  }

  // JWT 错误
  if (err.name === "JsonWebTokenError") {
    const message = "无效的访问令牌";
    error = new AuthenticationError(message);
  }

  if (err.name === "TokenExpiredError") {
    const message = "访问令牌已过期";
    error = new AuthenticationError(message);
  }

  // Axios 错误 (外部API调用)
  if (err.isAxiosError) {
    const message = "外部服务调用失败";
    const service = err.config?.baseURL || "unknown";
    error = new ExternalServiceError(message, service, err);
  }

  // 语法错误
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    const message = "请求数据格式错误";
    error = new ValidationError(message);
  }

  // 默认错误
  if (!error.isOperational) {
    error = new AppError("服务器内部错误", 500, "INTERNAL_SERVER_ERROR");
  }

  // 发送错误响应
  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || "UNKNOWN_ERROR",
      statusCode: error.statusCode || 500,
      timestamp: error.timestamp || new Date().toISOString(),
    },
  };

  // 开发环境下包含更多错误信息
  if (process.env.NODE_ENV === "development") {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = error.details;

    if (err.isAxiosError) {
      errorResponse.error.axiosDetails = {
        url: err.config?.url,
        method: err.config?.method,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
    }
  }

  // 生产环境下仅包含安全的错误信息
  if (process.env.NODE_ENV === "production") {
    // 对于服务器错误，不暴露具体错误信息
    if (error.statusCode >= 500) {
      errorResponse.error.message = "服务器内部错误，请稍后重试";
    }
  }

  res.status(error.statusCode || 500).json(errorResponse);
};

/**
 * 404 错误处理中间件
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`路由 ${req.originalUrl} 不存在`);
  next(error);
};

/**
 * 异步错误捕获包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 验证中间件包装器
 */
const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], {
      allowUnknown: false,
      abortEarly: false,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      return next(new ValidationError("请求参数验证失败", details));
    }

    next();
  };
};

// DISABLED - Rate limiting removed
// /**
//  * 速率限制错误处理
//  */
// const rateLimitHandler = (req, res) => {
//   const error = new RateLimitError("请求频率过高，请稍后重试");

//   res.status(error.statusCode).json({
//     success: false,
//     error: {
//       message: error.message,
//       code: error.errorCode,
//       statusCode: error.statusCode,
//       timestamp: error.timestamp,
//       retryAfter: Math.round(req.rateLimit?.resetTime / 1000) || 60,
//     },
//   });
// };

/**
 * 安全错误处理 - 防止信息泄露
 */
const sanitizeError = (error) => {
  // 敏感信息列表
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /credential/i,
    /authorization/i,
  ];

  let sanitizedMessage = error.message;
  let sanitizedStack = error.stack;

  // 移除敏感信息
  sensitivePatterns.forEach((pattern) => {
    if (pattern.test(sanitizedMessage)) {
      sanitizedMessage = "敏感信息错误";
    }
    if (sanitizedStack && pattern.test(sanitizedStack)) {
      sanitizedStack = sanitizedStack.replace(pattern, "[REDACTED]");
    }
  });

  return {
    message: sanitizedMessage,
    stack: process.env.NODE_ENV === "development" ? sanitizedStack : undefined,
  };
};

/**
 * 错误恢复策略
 */
const createRetryStrategy = (maxRetries = 3, baseDelay = 1000) => {
  return async (operation, context = {}) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // 记录重试日志
        logger.warn(`操作失败，正在重试 (${attempt}/${maxRetries})`, {
          error: error.message,
          context,
        });

        // 最后一次尝试失败后抛出错误
        if (attempt === maxRetries) {
          break;
        }

        // 指数退避延迟
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
};

module.exports = {
  // 错误类
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  DatabaseError,

  // 中间件
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,

  // 工具函数
  sanitizeError,
  createRetryStrategy,
};
