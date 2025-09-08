import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, Divider, message, Space } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  LoginOutlined,
} from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import { useAuthStore } from "../../stores/authStore";

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useLocalizedNavigate();
  const location = useLocation();

  // 检查是否有来自邮箱验证的成功消息
  useEffect(() => {
    if (location.state?.message) {
      message.success(location.state.message);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // 处理登录
  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login({
        username: values.username,
        password: values.password,
      });
      navigate("dashboard");
    } catch (error: any) {
      // 检查是否是账户验证相关的错误
      if (error.message === "账户尚未激活，请先完成验证") {
        // 可以在这里提供验证选项或跳转到验证页面
        message.info(t("auth.completeVerification"));
      }
      // 其他错误已在 store 中处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: "480px",
          borderRadius: "20px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
          border: "none",
        }}
        styles={{ body: { padding: "48px 40px" } }}
      >
        {/* Logo 和标题 */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              background: "linear-gradient(135deg, #1890ff 0%, #52c41a 100%)",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
              color: "#fff",
              fontWeight: "bold",
              boxShadow: "0 8px 24px rgba(24, 144, 255, 0.3)",
            }}
          >
            <UserOutlined />
          </div>
          <Title level={2} style={{ margin: 0, color: "#262626", fontWeight: "600" }}>
            {t("auth.welcomeBack")}
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "16px", marginTop: "8px", display: "block" }}>
            {t("auth.loginWithCredentials")}
          </Text>
        </div>

        {/* 登录表单 */}
        <Form form={form} layout="vertical" onFinish={handleLogin} size="large" autoComplete="off">
          {/* 用户名 */}
          <Form.Item
            name="username"
            rules={[
              { required: true, message: t("auth.enterUsername") },
              { min: 3, message: t("auth.usernameMinLength") },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#1890ff" }} />}
              placeholder={t("common.username")}
              autoComplete="username"
              size="large"
              style={{ height: "48px", fontSize: "16px" }}
            />
          </Form.Item>

          {/* 密码 */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: t("auth.enterPassword") },
              { min: 6, message: t("auth.passwordMinLength") },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#1890ff" }} />}
              placeholder={t("common.password")}
              autoComplete="current-password"
              size="large"
              style={{ height: "48px", fontSize: "16px" }}
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          {/* 登录按钮 */}
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              icon={<LoginOutlined />}
              style={{
                height: "48px",
                fontSize: "16px",
                fontWeight: "500",
                borderRadius: "8px",
              }}
            >
              {t("common.login")}
            </Button>
          </Form.Item>
        </Form>

        {/* 分隔线 */}
        <Divider style={{ margin: "32px 0" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "14px" }}>{t("common.or")}</Text>
        </Divider>

        {/* 其他选项 */}
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {/* 注册链接 */}
          <div style={{ textAlign: "center" }}>
            <Text style={{ color: "#8c8c8c", fontSize: "16px" }}>
              {t("auth.noAccount")}{" "}
              <Button
                type="link"
                onClick={() => navigate("register")}
                style={{
                  color: "#1890ff",
                  fontWeight: "600",
                  textDecoration: "none",
                  fontSize: "16px",
                  padding: 0,
                  height: "auto",
                }}
              >
                {t("auth.registerNow")}
              </Button>
            </Text>
          </div>
        </Space>

        {/* 底部信息 */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "12px" }}>
            {t("auth.loginAgreement")}{" "}
            <span style={{ color: "#1890ff", cursor: "pointer" }} onClick={() => navigate("terms")}>
              {t("common.terms")}
            </span>{" "}
            {t("auth.and")}{" "}
            <span
              style={{ color: "#1890ff", cursor: "pointer" }}
              onClick={() => navigate("privacy")}
            >
              {t("common.privacy")}
            </span>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
