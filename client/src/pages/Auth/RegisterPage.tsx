import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Divider, message } from "antd";
import { UserOutlined, LockOutlined, UserAddOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();
  const navigate = useNavigate();

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

      // 检查是否需要验证或直接跳转
      if (response?.redirect_to === "dashboard") {
        // 账户已自动激活，直接跳转到仪表板
        message.success("注册成功！账户已激活，正在跳转到仪表板...");

        // 存储用户信息和token
        localStorage.setItem("token", response.accessToken);
        localStorage.setItem("refreshToken", response.refreshToken);
        localStorage.setItem("user", JSON.stringify(response.user));

        // 延迟跳转到仪表板
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } else {
        // 需要验证，跳转到验证页面
        const navigationState = {
          username: values.username,
          userId: response?.user?.id,
          accessToken: response?.accessToken,
          refreshToken: response?.refreshToken,
          verificationMethods: response?.verification_methods || ["email", "sms"],
        };

        console.log("RegisterPage - Navigating to /verify with state:", navigationState);
        const encodedState = btoa(JSON.stringify(navigationState));
        window.location.href = `/verify?state=${encodedState}`;
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
        bodyStyle={{ padding: "48px 40px" }}
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
            创建账户
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "16px", marginTop: "8px", display: "block" }}>
            填写基本信息完成注册
          </Text>
        </div>

        {/* 注册表单 */}
        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" autoComplete="off">
          {/* 用户名 */}
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, message: "用户名至少3个字符" },
              { max: 30, message: "用户名最多30个字符" },
              { pattern: /^[a-zA-Z0-9]+$/, message: "用户名只能包含字母和数字" },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#1890ff" }} />}
              placeholder="用户名"
              autoComplete="username"
              size="large"
              style={{ height: "48px", fontSize: "16px" }}
            />
          </Form.Item>

          {/* 密码 */}
          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少6个字符" },
              { max: 100, message: "密码最多100个字符" },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: "密码必须包含大小写字母和数字",
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#52c41a" }} />}
              placeholder="密码"
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
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#52c41a" }} />}
              placeholder="确认密码"
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
              创建账户
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
            已有账户？{" "}
            <Link
              to="/login"
              style={{
                color: "#1890ff",
                fontWeight: "600",
                textDecoration: "none",
                fontSize: "16px",
              }}
            >
              立即登录
            </Link>
          </Text>
        </div>

        {/* 底部信息 */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "12px" }}>
            注册即表示同意我们的{" "}
            <span style={{ color: "#1890ff", cursor: "pointer" }}>服务条款</span> 和{" "}
            <span style={{ color: "#1890ff", cursor: "pointer" }}>隐私政策</span>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
