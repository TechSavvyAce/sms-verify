import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Divider, message } from "antd";
import { UserOutlined, LockOutlined, UserAddOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/authStore";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();
  const navigate = useLocalizedNavigate();

  const handleSubmit = async (values: {
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    try {
      setLoading(true);
      console.log("RegisterPage - Starting registration with:", values);

      // 构建注册数据
      const userData = {
        username: values.username,
        password: values.password,
      };

      console.log("RegisterPage - Calling register function with:", userData);
      const response = await register(userData);
      console.log("RegisterPage - Registration response:", response);
      console.log("RegisterPage - Response structure:", {
        hasRedirectTo: !!response?.redirect_to,
        redirectTo: response?.redirect_to,
        responseKeys: Object.keys(response || {}),
        fullResponse: response,
      });

      // 检查是否需要验证或直接跳转
      if (response?.redirect_to === "dashboard") {
        console.log("RegisterPage - Auto-activating account, redirecting to dashboard");
        // 账户已自动激活，直接跳转到仪表板
        message.success("注册成功！账户已激活，正在跳转到仪表板...");

        // 存储用户信息和token
        localStorage.setItem("token", response.accessToken);
        localStorage.setItem("refreshToken", response.refreshToken);
        localStorage.setItem("user", JSON.stringify(response.user));

        // 延迟跳转到仪表板
        setTimeout(() => {
          navigate("dashboard");
        }, 2000);
      } else {
        console.log("RegisterPage - Account needs verification, redirecting to verify page");
        // 需要验证，跳转到验证页面
        const navigationState = {
          username: values.username,
          userId: response?.user?.id,
          accessToken: response?.accessToken,
          refreshToken: response?.refreshToken,
          verificationMethods: response?.verification_methods || ["email", "sms"],
        };

        console.log("RegisterPage - Navigating to verify with state:", navigationState);
        const encodedState = btoa(JSON.stringify(navigationState));
        navigate(`verify?state=${encodedState}`);
      }
    } catch (error: any) {
      console.error("RegisterPage - Registration failed:", error);
      // 错误已在 store 中处理，这里可以添加额外的错误处理逻辑
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
            <UserAddOutlined />
          </div>
          <Title level={2} style={{ margin: 0, color: "#262626", fontWeight: "600" }}>
            {t("auth.registerTitle")}
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "16px", marginTop: "8px", display: "block" }}>
            {t("auth.registerDescription")}
          </Text>
        </div>

        {/* 注册表单 */}
        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" autoComplete="off">
          {/* 用户名 */}
          <Form.Item
            name="username"
            rules={[
              { required: true, message: t("auth.usernameRequired") },
              { min: 3, message: t("auth.usernameMinLength") },
              { max: 30, message: t("auth.usernameMaxLength") },
              { pattern: /^[a-zA-Z0-9]+$/, message: t("auth.usernamePattern") },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#1890ff" }} />}
              placeholder={t("auth.usernamePlaceholder")}
              autoComplete="username"
              size="large"
              style={{ height: "48px", fontSize: "16px" }}
            />
          </Form.Item>

          {/* 密码 */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: t("auth.passwordRequired") },
              { min: 6, message: t("auth.passwordMinLength") },
              { max: 100, message: t("auth.passwordMaxLength") },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: t("auth.passwordPattern"),
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#52c41a" }} />}
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete="new-password"
              size="large"
              style={{ height: "48px", fontSize: "16px" }}
            />
          </Form.Item>

          {/* 确认密码 */}
          <Form.Item
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: t("auth.confirmPasswordRequired") },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t("auth.passwordMismatch")));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#52c41a" }} />}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              size="large"
              style={{ height: "48px", fontSize: "16px" }}
            />
          </Form.Item>

          {/* 注册按钮 */}
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              icon={<UserAddOutlined />}
              style={{
                height: "48px",
                fontSize: "16px",
                fontWeight: "500",
                borderRadius: "8px",
              }}
            >
              {t("auth.createAccount")}
            </Button>
          </Form.Item>
        </Form>

        {/* 分隔线 */}
        <Divider style={{ margin: "32px 0" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "14px" }}>或</Text>
        </Divider>

        {/* 其他选项 */}
        <div style={{ textAlign: "center" }}>
          <Text style={{ color: "#8c8c8c", fontSize: "16px" }}>
            {t("auth.haveAccount")}{" "}
            <Button
              type="link"
              onClick={() => navigate("login")}
              style={{
                color: "#1890ff",
                fontWeight: "600",
                textDecoration: "none",
                fontSize: "16px",
                padding: 0,
                height: "auto",
              }}
            >
              {t("auth.loginNow")}
            </Button>
          </Text>
        </div>

        {/* 底部信息 */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "12px" }}>
            {t("auth.registerAgreement")}{" "}
            <span style={{ color: "#1890ff", cursor: "pointer" }} onClick={() => navigate("terms")}>
              {t("auth.termsOfService")}
            </span>{" "}
            {t("auth.and")}{" "}
            <span
              style={{ color: "#1890ff", cursor: "pointer" }}
              onClick={() => navigate("privacy")}
            >
              {t("auth.privacyPolicy")}
            </span>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
