import { create } from "zustand";
import { message } from "antd";
import { AuthState, User, LoginRequest, RegisterRequest, RegisterResponse } from "../types";
import { authApi } from "../services/api";
import { getApiErrorMessage } from "../utils/errorHelpers";

// 数据标准化函数
const normalizeUserData = (user: any): User => {
  return {
    ...user,
    balance: typeof user.balance === "number" ? user.balance : parseFloat(user.balance) || 0,
    total_spent:
      typeof user.total_spent === "number" ? user.total_spent : parseFloat(user.total_spent) || 0,
    total_recharged:
      typeof user.total_recharged === "number"
        ? user.total_recharged
        : parseFloat(user.total_recharged) || 0,
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem("token"),
  refreshToken: localStorage.getItem("refreshToken"),
  isAuthenticated: false,
  isLoading: false,

  // 初始化认证状态
  initializeAuth: async () => {
    const { token } = get();

    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    // 验证token格式
    if (typeof token !== "string" || token.trim() === "") {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        const normalizedUser = normalizeUserData(response.data);

        // 检查用户状态 - 只有active状态的用户才算完全认证
        const isFullyAuthenticated = normalizedUser.status === "active";

        set({
          user: normalizedUser,
          isAuthenticated: isFullyAuthenticated,
          isLoading: false,
        });
      } else {
        // 不要自动刷新token，直接清除认证状态
        console.log("用户资料获取失败，清除认证状态");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error("初始化认证失败:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login(credentials);

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        // 标准化用户数据
        const normalizedUser = normalizeUserData(user);

        // 保存到 localStorage
        localStorage.setItem("token", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        // 检查用户状态 - 只有active状态的用户才算完全认证
        const isFullyAuthenticated = normalizedUser.status === "active";

        set({
          user: normalizedUser,
          token: accessToken,
          refreshToken,
          isAuthenticated: isFullyAuthenticated,
          isLoading: false,
        });

        if (isFullyAuthenticated) {
          message.success(`欢迎回来，${normalizedUser.username}！`);
        } else {
          message.warning(`登录成功，但账户状态为 ${normalizedUser.status}，请完成邮箱验证。`);
        }
      } else {
        throw new Error(getApiErrorMessage(response.error, "登录失败"));
      }
    } catch (error: any) {
      set({ isLoading: false });

      // 处理特定的错误情况
      if (error.response?.data?.code === "ACCOUNT_PENDING") {
        const userId = error.response.data.userId;
        message.error("账户尚未激活，请先完成验证");
        // 可以在这里跳转到验证页面或显示验证提示
        throw new Error("账户尚未激活，请先完成验证");
      } else if (error.response?.data?.code === "ACCOUNT_SUSPENDED") {
        message.error("账户已被停用，请联系客服");
        throw new Error("账户已被停用，请联系客服");
      } else {
        message.error(error.message || "登录失败，请重试");
        throw error;
      }
    }
  },

  register: async (userData: RegisterRequest) => {
    set({ isLoading: true });
    try {
      console.log("AuthStore - Calling authApi.register with:", userData);
      const response = await authApi.register(userData);
      console.log("AuthStore - Raw API response:", response);

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        console.log("AuthStore - Extracted data:", { user, accessToken, refreshToken });
        console.log("AuthStore - Full response.data:", response.data);
        console.log("AuthStore - Has redirect_to:", !!response.data.redirect_to);
        console.log("AuthStore - redirect_to value:", response.data.redirect_to);

        // 标准化用户数据
        const normalizedUser = normalizeUserData(user);
        console.log("AuthStore - Normalized user:", normalizedUser);

        // 保存到 localStorage
        localStorage.setItem("token", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        // 检查用户状态 - 只有active状态的用户才算完全认证
        const isFullyAuthenticated = normalizedUser.status === "active";

        set({
          user: normalizedUser,
          token: accessToken,
          refreshToken,
          isAuthenticated: isFullyAuthenticated, // 只有active状态才算认证
          isLoading: false,
        });

        console.log("AuthStore - Returning response data:", response.data);
        return response.data as RegisterResponse;
      } else {
        console.error("AuthStore - API response not successful:", response);
        throw new Error(getApiErrorMessage(response.error, "注册失败"));
      }
    } catch (error: any) {
      console.error("AuthStore - Registration error:", error);
      set({ isLoading: false });
      message.error(error.message || "注册失败，请重试");
      throw error;
    }
  },

  logout: () => {
    // 清除本地存储
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });

    message.info("已退出登录");
  },

  refreshAuth: async () => {
    const { refreshToken } = get();

    if (!refreshToken) {
      throw new Error("没有刷新令牌");
    }

    // 验证refreshToken格式
    if (typeof refreshToken !== "string" || refreshToken.trim() === "") {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      throw new Error("刷新令牌格式无效");
    }

    set({ isLoading: true });
    try {
      const response = await authApi.refresh({ refreshToken });

      if (response.success && response.data) {
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // 更新 localStorage
        localStorage.setItem("token", accessToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }

        // 获取用户信息
        const userResponse = await authApi.getProfile();
        if (userResponse.success && userResponse.data) {
          // 标准化用户数据
          const normalizedUser = normalizeUserData(userResponse.data);

          // 检查用户状态 - 只有active状态的用户才算完全认证
          const isFullyAuthenticated = normalizedUser.status === "active";

          set({
            user: normalizedUser,
            token: accessToken,
            refreshToken: newRefreshToken || refreshToken,
            isAuthenticated: isFullyAuthenticated,
            isLoading: false,
          });
        } else {
          throw new Error("获取用户信息失败");
        }
      } else {
        throw new Error(getApiErrorMessage(response.error, "刷新令牌失败"));
      }
    } catch (error: any) {
      // 刷新失败，清除认证状态
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");

      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });

      throw error;
    }
  },

  updateUser: (userData: Partial<User>) => {
    const { user } = get();
    if (user) {
      // 标准化更新的用户数据
      const updatedUser = normalizeUserData({ ...user, ...userData });
      set({
        user: updatedUser,
      });
    }
  },

  // 更新用户余额（用于实时更新）
  updateBalance: (changeAmount: number, newBalance?: number) => {
    const { user } = get();
    if (user) {
      const updatedBalance = newBalance !== undefined ? newBalance : user.balance + changeAmount;

      const updatedUser = normalizeUserData({
        ...user,
        balance: updatedBalance,
      });

      set({
        user: updatedUser,
      });

      console.log(
        `余额更新: ${changeAmount > 0 ? "+" : ""}${changeAmount}, 新余额: ${updatedBalance}`
      );
    }
  },
}));
