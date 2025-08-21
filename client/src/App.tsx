import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "antd";
import { useAuthStore } from "./stores/authStore";
import { useWebSocket } from "./hooks/useWebSocket";
import AppHeader from "./components/Layout/AppHeader";
import AppSidebar from "./components/Layout/AppSidebar";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import LoadingSpinner from "./components/Common/LoadingSpinner";
import ErrorBoundary from "./components/Common/ErrorBoundary";

// 页面组件
import LoginPage from "./pages/Auth/LoginPage";
import RegisterPage from "./pages/Auth/RegisterPage";
import EmailVerificationPage from "./pages/Auth/EmailVerificationPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import GetNumberPage from "./pages/Services/GetNumberPage";
import RentNumberPage from "./pages/Services/RentNumberPage";
import ActivationsPage from "./pages/Activations/ActivationsPage";
import RentalsPage from "./pages/Rentals/RentalsPage";
import TransactionsPage from "./pages/Transactions/TransactionsPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import SettingsPage from "./pages/Settings/SettingsPage";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminUsersPage from "./pages/Admin/AdminUsersPage";
import AdminSystemPage from "./pages/Admin/AdminSystemPage";
import AdminTransactionsPage from "./pages/Admin/AdminTransactionsPage";
import NotFoundPage from "./pages/Error/NotFoundPage";

const { Content } = Layout;

const App: React.FC = () => {
  const { isAuthenticated, isLoading, user, initializeAuth } = useAuthStore();
  const [collapsed, setCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // WebSocket 连接
  useWebSocket();

  // 检查移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 应用初始化
  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    initApp();
  }, [initializeAuth]);

  // 显示全局加载状态
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <LoadingSpinner size="large" tip="正在加载应用..." />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* 公开路由 */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
        />
        <Route path="/verify-email" element={<EmailVerificationPage />} />

        {/* 受保护的路由 */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout style={{ minHeight: "100vh" }}>
                {/* 侧边栏 */}
                <AppSidebar collapsed={collapsed} isMobile={isMobile} onCollapse={setCollapsed} />

                <Layout style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 280 }}>
                  {/* 顶部导航 */}
                  <AppHeader
                    collapsed={collapsed}
                    onCollapse={() => setCollapsed(!collapsed)}
                    isMobile={isMobile}
                  />

                  {/* 主内容区 */}
                  <Content
                    style={{
                      margin: isMobile ? "8px" : "16px",
                      padding: isMobile ? "16px" : "24px",
                      background: "#f5f5f5",
                      borderRadius: "8px",
                      minHeight: "calc(100vh - 112px)",
                      overflow: "auto",
                      transition: "margin-left 0.2s",
                    }}
                  >
                    <ErrorBoundary>
                      <Routes>
                        {/* 默认重定向到仪表板 */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />

                        {/* 仪表板 */}
                        <Route path="/dashboard" element={<DashboardPage />} />

                        {/* 服务相关页面 */}
                        <Route path="/get-number" element={<GetNumberPage />} />
                        <Route path="/rent-number" element={<RentNumberPage />} />

                        {/* 记录查看页面 */}
                        <Route path="/activations" element={<ActivationsPage />} />
                        <Route path="/rentals" element={<RentalsPage />} />
                        <Route path="/transactions" element={<TransactionsPage />} />

                        {/* 用户相关页面 */}
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/settings" element={<SettingsPage />} />

                        {/* 管理员页面 */}
                        {user?.id === 1 && (
                          <>
                            <Route
                              path="/admin/dashboard"
                              element={
                                <ProtectedRoute requireAdmin>
                                  <AdminDashboard />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/admin/users"
                              element={
                                <ProtectedRoute requireAdmin>
                                  <AdminUsersPage />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/admin/system"
                              element={
                                <ProtectedRoute requireAdmin>
                                  <AdminSystemPage />
                                </ProtectedRoute>
                              }
                            />
                            <Route
                              path="/admin/transactions"
                              element={
                                <ProtectedRoute requireAdmin>
                                  <AdminTransactionsPage />
                                </ProtectedRoute>
                              }
                            />
                          </>
                        )}

                        {/* 404 页面 */}
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </ErrorBoundary>
                  </Content>
                </Layout>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
