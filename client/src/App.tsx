import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout, Button, Tooltip } from "antd";
import { MessageOutlined } from "@ant-design/icons";
import { useAuthStore } from "./stores/authStore";
import { useWebSocket } from "./hooks/useWebSocket";
import { useLocalizedNavigate } from "./hooks/useLocalizedNavigate";
import AppHeader from "./components/Layout/AppHeader";
import AppSidebar from "./components/Layout/AppSidebar";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import LoadingSpinner from "./components/Common/LoadingSpinner";
import ErrorBoundary from "./components/Common/ErrorBoundary";
import "./i18n";

// 页面组件
import LoginPage from "./pages/Auth/LoginPage";
import RegisterPage from "./pages/Auth/RegisterPage";

import DashboardPage from "./pages/Dashboard/DashboardPage";
import GetNumberPage from "./pages/Services/GetNumberPage";
import ActivationsPage from "./pages/Activations/ActivationsPage";
import TransactionsPage from "./pages/Transactions/TransactionsPage";
import AdminUsersPage from "./pages/Admin/AdminUsersPage";
import AdminTransactionsPage from "./pages/Admin/AdminTransactionsPage";
import AdminPricingPage from "./pages/Admin/AdminPricingPage";
import NotFoundPage from "./pages/Error/NotFoundPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import BalancePage from "./pages/Balance/BalancePage";
import VerificationPage from "./pages/Auth/VerificationPage";
import TermsOfServicePage from "./pages/Legal/TermsOfServicePage";
import PrivacyPolicyPage from "./pages/Legal/PrivacyPolicyPage";

const { Content } = Layout;

// Custom redirect component that uses localized navigation
const LocalizedRedirect: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useLocalizedNavigate();

  useEffect(() => {
    console.log("LocalizedRedirect: redirecting to", to, "from", window.location.pathname);
    console.trace("LocalizedRedirect stack trace");
    navigate(to, { replace: true });
  }, [navigate, to]);

  return <LoadingSpinner size="small" tip="正在跳转..." />;
};

const App: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // 显示全局加载状态
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <LoadingSpinner size="large" tip="正在加载应用..." />
      </div>
    );
  }

  return (
    <Routes>
      {/* Language-specific routes */}
      <Route path="/:lang/*" element={<AppWithLanguage />} />
      {/* Redirect root to default language */}
      <Route path="/" element={<Navigate to="/zh-CN" replace />} />
    </Routes>
  );
};

const AppWithLanguage: React.FC = () => {
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

  // 应用初始化 - 只调用一次
  const initRef = React.useRef(false);

  useEffect(() => {
    console.log("App: useEffect 被调用, initRef.current =", initRef.current);

    if (initRef.current) {
      console.log("App: 初始化已经完成，跳过重复调用");
      return;
    }

    initRef.current = true;

    const initApp = async () => {
      try {
        console.log("App: 开始初始化认证...");
        await initializeAuth();
        console.log("App: 认证初始化完成");
      } catch (error) {
        console.error("初始化应用失败:", error);
      }
    };

    initApp();
  }, []); // 空依赖数组，只运行一次

  // 显示全局加载状态
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <LoadingSpinner size="large" tip="正在加载应用..." />
      </div>
    );
  }

  return (
    <Routes>
      {/* 公开路由 */}
      <Route
        path="login"
        element={isAuthenticated ? <LocalizedRedirect to="dashboard" /> : <LoginPage />}
      />
      <Route
        path="register"
        element={isAuthenticated ? <LocalizedRedirect to="dashboard" /> : <RegisterPage />}
      />
      <Route path="verify" element={<VerificationPage />} />
      <Route path="terms" element={<TermsOfServicePage />} />
      <Route path="privacy" element={<PrivacyPolicyPage />} />

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
                      {/* 默认重定向到仪表板 - 只有当路径完全为空时才重定向 */}
                      <Route path="" element={<Navigate to="dashboard" replace />} />

                      {/* 仪表板 */}
                      <Route path="dashboard" element={<DashboardPage />} />

                      {/* 服务相关页面 */}
                      <Route path="get-number" element={<GetNumberPage />} />

                      {/* 记录查看页面 */}
                      <Route path="activations" element={<ActivationsPage />} />
                      <Route path="transactions" element={<TransactionsPage />} />

                      {/* 用户相关页面 */}
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="balance" element={<BalancePage />} />

                      {/* 管理员页面 */}
                      {user?.id === 1 && (
                        <>
                          <Route
                            path="admin/users"
                            element={
                              <ProtectedRoute requireAdmin>
                                <AdminUsersPage />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="admin/transactions"
                            element={
                              <ProtectedRoute requireAdmin>
                                <AdminTransactionsPage />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="admin/pricing"
                            element={
                              <ProtectedRoute requireAdmin>
                                <AdminPricingPage />
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

                {/* 浮动支持按钮 */}
                <a href="https://t.me/lufeng1868" target="_blank" rel="noreferrer"
                  style={{ position: "fixed", bottom: isMobile ? 16 : 24, right: isMobile ? 16 : 24, zIndex: 1100 }}>
                  <Tooltip title="Telegram: @lufeng1868">
                    <Button type="primary" shape="round" size={isMobile ? "middle" : "large"} icon={<MessageOutlined />}
                      style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.2)" }}>
                      Support
                    </Button>
                  </Tooltip>
                </a>
              </Layout>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
