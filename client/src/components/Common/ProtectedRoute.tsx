import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import LoadingSpinner from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return <LoadingSpinner overlay tip="正在验证身份..." />;
  }

  // 如果未认证，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 如果需要管理员权限但用户不是管理员
  if (requireAdmin && user?.id !== 1) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
