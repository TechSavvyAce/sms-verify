import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { message } from "antd";
import {
  ApiResponse,
  PaginatedResponse,
  User,
  Service,
  Country,
  Activation,
  Rental,
  Transaction,
  UserStats,
  SystemStats,
  LoginRequest,
  RegisterRequest,
  CreateActivationRequest,
  CreateActivationFreePriceRequest,
  CreateRentalRequest,
  SearchFilters,
} from "../types";

// API 配置
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// 创建 axios 实例
const createApiInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // 请求拦截器 - 添加 token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器 - 处理错误和 token 刷新
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // 处理 401 错误 - token 过期
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // 尝试刷新 token
          const refreshToken = localStorage.getItem("refreshToken");
          if (refreshToken) {
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            if (response.data.success) {
              const { accessToken, refreshToken: newRefreshToken } = response.data.data;
              localStorage.setItem("token", accessToken);
              if (newRefreshToken) {
                localStorage.setItem("refreshToken", newRefreshToken);
              }

              // 重试原请求
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return instance(originalRequest);
            }
          }
        } catch (refreshError) {
          // 刷新失败，清除 token 并跳转到登录页
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      }

      // 处理其他错误
      const errorMessage = error.response?.data?.error || error.message || "请求失败";

      // 不显示某些特定错误的消息提示
      const silentErrors = ["TOKEN_EXPIRED", "TOKEN_INVALID"];
      const errorCode = error.response?.data?.code;

      if (!silentErrors.includes(errorCode) && error.response?.status >= 400) {
        // 确保 errorMessage 是字符串
        const messageText =
          typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage);

        // 根据错误类型提供更友好的错误信息
        if (error.response?.status === 0 || error.code === "NETWORK_ERROR") {
          message.error("网络连接失败，请检查网络后重试");
        } else if (error.response?.status === 500) {
          message.error("服务器内部错误，请稍后重试");
        } else if (error.response?.status === 503) {
          message.error("服务暂时不可用，请稍后重试");
        } else {
          message.error(messageText);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

const api = createApiInstance();

// 通用请求方法
const request = async <T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> => {
  try {
    console.log("API Request:", config.method?.toUpperCase(), config.url, config.data);
    const response = await api.request<ApiResponse<T>>(config);
    console.log("API Response:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("API Error:", {
      method: config.method,
      url: config.url,
      data: config.data,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
    });

    // 返回标准化的错误响应
    return {
      success: false,
      error: error.response?.data?.error || error.message || "请求失败",
    };
  }
};

// 认证 API
export const authApi = {
  // 用户登录
  login: (credentials: LoginRequest): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/login", data: credentials }),

  // 用户注册
  register: (userData: RegisterRequest): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/register", data: userData }),

  // 邮箱验证
  verifyEmail: (code: string): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/verify-email", data: { code } }),

  // 发送验证邮件
  sendVerification: (email: string, userId?: number): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/send-email-verification", data: { email, userId } }),

  // 重新发送验证邮件
  resendVerificationEmail: (email: string): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/resend-verification", data: { email } }),

  // 手机号码验证（无需发送SMS）
  verifyPhone: (phone: string): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/verify-phone", data: { phone } }),

  // 刷新 token
  refresh: (data: { refreshToken: string }): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/refresh", data }),

  // 用户注销
  logout: (): Promise<ApiResponse> => request({ method: "POST", url: "/auth/logout" }),

  // 获取用户资料
  getProfile: (): Promise<ApiResponse<User>> => request({ method: "GET", url: "/user/profile" }),

  // 更新用户资料
  updateProfile: (data: Partial<User>): Promise<ApiResponse<User>> =>
    request({ method: "PUT", url: "/user/profile", data }),

  // 忘记密码
  forgotPassword: (email: string): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/forgot-password", data: { email } }),

  // 重置密码
  resetPassword: (token: string, newPassword: string): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: "/auth/reset-password",
      data: { token, newPassword },
    }),

  // 设置初始密码
  setPassword: (username: string, password: string): Promise<ApiResponse> =>
    request({ method: "POST", url: "/auth/set-password", data: { username, password } }),
};

// 用户 API
export const userApi = {
  // 获取用户资料
  getProfile: (): Promise<ApiResponse<User>> => request({ method: "GET", url: "/user/profile" }),

  // 更新用户资料
  updateProfile: (data: Partial<User> | FormData): Promise<ApiResponse<User>> =>
    request({ method: "PUT", url: "/user/profile", data }),

  // 获取用户余额
  getBalance: (): Promise<ApiResponse> => request({ method: "GET", url: "/user/balance" }),

  // 获取交易历史
  getTransactions: (
    params?: SearchFilters & { page?: number; limit?: number }
  ): Promise<ApiResponse<PaginatedResponse<Transaction>>> =>
    request({ method: "GET", url: "/user/transactions", params }),

  // 获取用户统计
  getStats: (): Promise<ApiResponse<UserStats>> => request({ method: "GET", url: "/user/stats" }),

  // 获取用户活动
  getActivities: (params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResponse<any>>> =>
    request({ method: "GET", url: "/user/activities", params }),

  // 获取活动日志
  getActivityLogs: (params?: { page?: number; limit?: number }): Promise<ApiResponse> =>
    request({ method: "GET", url: "/user/activity-logs", params }),

  // 获取安全设置
  getSecuritySettings: (): Promise<ApiResponse> =>
    request({ method: "GET", url: "/user/security-settings" }),

  // 更新头像
  updateAvatar: (data: FormData): Promise<ApiResponse> =>
    request({
      method: "PUT",
      url: "/user/avatar",
      data,
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // 更新通知设置
  updateNotifications: (data: {
    email_notifications?: boolean;
    sms_notifications?: boolean;
    push_notifications?: boolean;
  }): Promise<ApiResponse> => request({ method: "PUT", url: "/user/notifications", data }),
};

// 服务 API
export const serviceApi = {
  // 获取服务列表
  getServices: (params?: {
    q?: string;
    category?: string;
  }): Promise<ApiResponse<{ services: Service[] }>> =>
    request({ method: "GET", url: "/services", params }),

  // 获取指定服务的国家列表
  getCountries: (service: string): Promise<ApiResponse<{ countries: Country[] }>> =>
    request({ method: "GET", url: `/services/${service}/countries` }),

  // 获取价格信息
  getPricing: (params?: { service?: string; country?: number }): Promise<ApiResponse> =>
    request({ method: "GET", url: "/services/pricing", params }),

  // 获取服务详情
  getServiceDetail: (service: string): Promise<ApiResponse> =>
    request({ method: "GET", url: `/services/${service}` }),

  // 搜索服务
  searchServices: (data: { query?: string; filters?: any }): Promise<ApiResponse> =>
    request({ method: "POST", url: "/services/search", data }),
};

// 激活 API
export const activationApi = {
  // 购买激活号码
  create: (data: CreateActivationRequest): Promise<ApiResponse<Activation>> =>
    request({ method: "POST", url: "/activations", data }),

  // 使用 FreePrice 购买激活号码
  createWithFreePrice: (data: CreateActivationFreePriceRequest): Promise<ApiResponse<Activation>> =>
    request({ method: "POST", url: "/activations/freeprice", data }),

  // 获取激活列表
  getList: (
    params?: SearchFilters & { page?: number; limit?: number }
  ): Promise<ApiResponse<PaginatedResponse<Activation>>> =>
    request({ method: "GET", url: "/activations", params }),

  // 获取激活详情
  getDetail: (id: number): Promise<ApiResponse<Activation>> =>
    request({ method: "GET", url: `/activations/${id}` }),

  // 检查激活状态
  checkStatus: (id: number): Promise<ApiResponse> =>
    request({ method: "GET", url: `/activations/${id}/status` }),

  // 取消激活
  cancel: (id: number): Promise<ApiResponse> =>
    request({ method: "POST", url: `/activations/${id}/cancel` }),

  // 确认激活完成
  confirm: (id: number): Promise<ApiResponse> =>
    request({ method: "POST", url: `/activations/${id}/confirm` }),

  // 请求重发短信
  retry: (id: number): Promise<ApiResponse> =>
    request({ method: "POST", url: `/activations/${id}/retry` }),

  // 批量检查状态
  batchCheck: (activationIds: number[]): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: "/activations/batch-check",
      data: { activation_ids: activationIds },
    }),

  // 批量检查激活状态（新端点）
  bulkCheckStatus: (activationIds: number[]): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: "/activations/bulk-check-status",
      data: { activation_ids: activationIds },
    }),

  // 获取运营商列表
  getOperators: (country?: number): Promise<ApiResponse<any>> =>
    request({
      method: "GET",
      url: "/activations/operators",
      params: { country },
    }),

  // 测试API连接
  testConnection: (): Promise<ApiResponse<any>> =>
    request({ method: "GET", url: "/activations/test-connection" }),
};

// 租用 API
export const rentalApi = {
  // 获取可用的租用服务和国家
  getServices: (params?: {
    time?: number;
    operator?: string;
    country?: number;
    incomingCall?: boolean;
    currency?: string;
  }): Promise<
    ApiResponse<{
      countries: Record<string, number>;
      operators: Record<string, string>;
      services: Record<string, { cost: number; quant: number }>;
      currency: string;
    }>
  > => request({ method: "GET", url: "/rentals/services", params }),

  // 租用手机号码
  create: (data: CreateRentalRequest): Promise<ApiResponse<Rental>> =>
    request({ method: "POST", url: "/rentals/order", data }),

  // 获取租用列表
  getList: (
    params?: SearchFilters & { page?: number; limit?: number }
  ): Promise<ApiResponse<PaginatedResponse<Rental>>> =>
    request({ method: "GET", url: "/rentals/list", params }),

  // 获取租用详情
  getDetail: (id: number): Promise<ApiResponse<Rental>> =>
    request({ method: "GET", url: `/rentals/${id}/status` }),

  // 获取租用短信 (通过状态接口获取)
  getSMS: (id: number): Promise<ApiResponse> =>
    request({ method: "GET", url: `/rentals/${id}/status` }),

  // 取消租用
  cancel: (id: number): Promise<ApiResponse> =>
    request({ method: "POST", url: `/rentals/${id}/cancel` }),

  // 续租
  extend: (id: number, time: number): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: `/rentals/${id}/extend`,
      data: { time },
    }),

  // 获取延长信息
  getExtendInfo: (id: number, hours: number): Promise<ApiResponse> =>
    request({
      method: "GET",
      url: `/rentals/${id}/extend-info`,
      params: { hours },
    }),

  // 完成租用
  finish: (id: number): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: `/rentals/${id}/finish`,
    }),

  // 批量检查状态 (暂未实现)
  batchCheck: (rentalIds: number[]): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: "/rentals/batch-check",
      data: { rental_ids: rentalIds },
    }),
};

// 支付 API
export const paymentApi = {
  // 创建支付订单
  createPayment: (data: { amount: number; description?: string }): Promise<ApiResponse> =>
    request({ method: "POST", url: "/payment/create", data }),

  // 获取支付历史
  getHistory: (params?: { page?: number; limit?: number }): Promise<ApiResponse> =>
    request({ method: "GET", url: "/payment/history", params }),

  // 获取支付状态
  getStatus: (paymentId: string): Promise<ApiResponse> =>
    request({ method: "GET", url: `/payment/status/${paymentId}` }),
};

// 管理员 API
export const adminApi = {
  // 获取系统统计
  getStats: (days?: number): Promise<ApiResponse<SystemStats>> =>
    request({ method: "GET", url: "/admin/stats", params: { days } }),

  // 获取用户列表
  getUsers: (
    params?: SearchFilters & { page?: number; limit?: number }
  ): Promise<ApiResponse<PaginatedResponse<User>>> =>
    request({ method: "GET", url: "/admin/users", params }),

  // 获取用户详情
  getUserDetail: (id: number): Promise<ApiResponse> =>
    request({ method: "GET", url: `/admin/users/${id}` }),

  // 更新用户状态
  updateUserStatus: (id: number, status: string, reason?: string): Promise<ApiResponse> =>
    request({
      method: "PUT",
      url: `/admin/users/${id}/status`,
      data: { status, reason },
    }),

  // 调整用户余额
  adjustBalance: (
    id: number,
    amount: number,
    type: "add" | "subtract",
    description?: string
  ): Promise<ApiResponse> =>
    request({
      method: "POST",
      url: `/admin/users/${id}/balance`,
      data: { amount, type, description },
    }),

  // 获取系统配置
  getConfig: (): Promise<ApiResponse> => request({ method: "GET", url: "/admin/config" }),

  // 获取系统日志
  getLogs: (params?: {
    level?: string;
    days?: number;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse> => request({ method: "GET", url: "/admin/logs", params }),

  // 获取活跃激活列表
  getActiveActivations: (params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PaginatedResponse<Activation>>> =>
    request({ method: "GET", url: "/admin/activations/active", params }),

  // 获取交易记录
  getTransactions: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    dateRange?: [string, string];
  }): Promise<ApiResponse<PaginatedResponse<Transaction>>> =>
    request({ method: "GET", url: "/admin/transactions", params }),

  // 创建数据库备份
  createBackup: (): Promise<ApiResponse> => request({ method: "POST", url: "/admin/backup" }),

  // 发送系统通知
  sendNotification: (data: {
    title: string;
    message: string;
    type?: string;
    target_users?: string;
  }): Promise<ApiResponse> => request({ method: "POST", url: "/admin/notifications", data }),

  // 系统健康检查
  systemHealthCheck: (): Promise<ApiResponse> => request({ method: "GET", url: "/admin/health" }),
};

// 系统 API
export const systemApi = {
  // 健康检查
  health: (): Promise<ApiResponse> => request({ method: "GET", url: "/health" }),
};

// 导出默认 api 实例
export default api;
