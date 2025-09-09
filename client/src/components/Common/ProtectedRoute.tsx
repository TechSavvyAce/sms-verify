import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import LoadingSpinner from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireActiveStatus?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireActiveStatus = true,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();
  const navigate = useLocalizedNavigate();

  // 显示加载状态
  if (isLoading) {
    return <LoadingSpinner text="验证身份中..." tip="请稍候，正在检查您的登录状态" fullScreen />;
  }

  // 如果需要认证但用户未登录
  if (requireAuth && !isAuthenticated) {
    // 保存当前路径，登录后可以重定向回来
    navigate("login");
    return <LoadingSpinner text="重定向到登录页面..." tip="请稍候" fullScreen />;
  }

  // 如果需要活跃状态但用户状态不是active
  if (requireActiveStatus && user && user.status !== "active") {
    if (user.status === "pending") {
      // 用户需要验证，重定向到验证页面
      return (
        <Navigate
          to="/verify"
          state={{
            username: user.username,
            userId: user.id,
            requiresVerification: true,
          }}
          replace
        />
      );
    } else if (user.status === "suspended") {
      // 账户被停用，重定向到错误页面
      return (
        <Navigate
          to="/error"
          state={{
            error: "账户已被停用",
            message: "您的账户已被停用，请联系客服获取帮助",
          }}
          replace
        />
      );
    }
  }

  // 如果需要管理员权限但用户不是管理员
  if (requireAdmin && user?.id !== 1) {
    navigate("dashboard");
    return <LoadingSpinner text="重定向到仪表板..." tip="请稍候" fullScreen />;
  }

  // 如果用户已登录且状态正常，显示受保护的内容
  return <>{children}</>;
};

export default ProtectedRoute;
