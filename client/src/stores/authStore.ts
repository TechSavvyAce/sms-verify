import { create } from "zustand";
import { message } from "antd";
import { AuthState, User, LoginRequest, RegisterRequest } from "../types";
import { authApi } from "../services/api";

// 数据标准化函数
const normalizeUserData = (user: any): User => {
  return {
    ...user,
    balance:
      typeof user.balance === "number"
        ? user.balance
        : parseFloat(user.balance) || 0,
    total_spent:
      typeof user.total_spent === "number"
        ? user.total_spent
        : parseFloat(user.total_spent) || 0,
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

    set({ isLoading: true });
    try {
      const response = await authApi.getProfile();
      if (response.success && response.data) {
        const normalizedUser = normalizeUserData(response.data);
        set({
          user: normalizedUser,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        await get().refreshAuth();
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

        set({
          user: normalizedUser,
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });

        message.success(`欢迎回来，${normalizedUser.username}！`);
      } else {
        throw new Error(response.error || "登录失败");
      }
    } catch (error: any) {
      set({ isLoading: false });
      message.error(error.message || "登录失败，请重试");
      throw error;
    }
  },

  register: async (userData: RegisterRequest) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register(userData);

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        // 标准化用户数据
        const normalizedUser = normalizeUserData(user);

        // 保存到 localStorage
        localStorage.setItem("token", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        set({
          user: normalizedUser,
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });

        message.success(`注册成功，欢迎加入 ${normalizedUser.username}！`);
      } else {
        throw new Error(response.error || "注册失败");
      }
    } catch (error: any) {
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

          set({
            user: normalizedUser,
            token: accessToken,
            refreshToken: newRefreshToken || refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          throw new Error("获取用户信息失败");
        }
      } else {
        throw new Error(response.error || "刷新令牌失败");
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
      const updatedBalance =
        newBalance !== undefined ? newBalance : user.balance + changeAmount;

      const updatedUser = normalizeUserData({
        ...user,
        balance: updatedBalance,
      });

      set({
        user: updatedUser,
      });

      console.log(
        `余额更新: ${
          changeAmount > 0 ? "+" : ""
        }${changeAmount}, 新余额: ${updatedBalance}`
      );
    }
  },
}));
