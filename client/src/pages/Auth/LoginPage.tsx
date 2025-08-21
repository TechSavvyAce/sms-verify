import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, Divider, message, Space, Alert } from "antd";
import { UserOutlined, LockOutlined, MobileOutlined } from "@ant-design/icons";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { LoginRequest } from "../../types";

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // 检查是否有来自邮箱验证的成功消息
  useEffect(() => {
    if (location.state?.message) {
      message.success(location.state.message);
      // 清除state，避免重复显示
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  const handleSubmit = async (values: LoginRequest) => {
    setLoading(true);
    try {
      await login(values);
      navigate("/dashboard");
    } catch (error) {
      // 错误已在 store 中处理
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    const demoCredentials = {
      username: "demo",
      password: "demo123",
    };

    try {
      setLoading(true);
      await login(demoCredentials);
      navigate("/dashboard");
      message.success("已使用演示账户登录");
    } catch (error) {
      // 如果演示账户不存在，提示用户注册
      message.info("演示账户不存在，请注册新账户");
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
          maxWidth: "400px",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        }}
        bodyStyle={{ padding: "40px 32px" }}
      >
        {/* Logo 和标题 */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#1890ff",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "24px",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            <MobileOutlined />
          </div>
          <Title level={2} style={{ margin: 0, color: "#262626" }}>
            短信验证平台
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "14px" }}>可靠的短信验证解决方案</Text>
        </div>

        {/* 登录表单 */}
        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" autoComplete="off">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名或邮箱" },
              { min: 3, message: "用户名至少3个字符" },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#1890ff" }} />}
              placeholder="用户名或邮箱"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少6个字符" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#1890ff" }} />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: "48px",
                fontSize: "16px",
                fontWeight: "500",
                borderRadius: "8px",
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        {/* 分隔线 */}
        <Divider>
          <Text style={{ color: "#8c8c8c", fontSize: "12px" }}>或</Text>
        </Divider>

        {/* 演示登录 */}
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Button
            block
            onClick={handleDemoLogin}
            loading={loading}
            style={{
              height: "40px",
              borderRadius: "8px",
              borderColor: "#d9d9d9",
            }}
          >
            演示账户登录
          </Button>

          {/* 注册链接 */}
          <div style={{ textAlign: "center" }}>
            <Text style={{ color: "#8c8c8c" }}>
              还没有账户？{" "}
              <Link
                to="/register"
                style={{
                  color: "#1890ff",
                  fontWeight: "500",
                  textDecoration: "none",
                }}
              >
                立即注册
              </Link>
            </Text>
          </div>

          {/* 忘记密码 */}
          <div style={{ textAlign: "center" }}>
            <Link
              to="/forgot-password"
              style={{
                color: "#8c8c8c",
                fontSize: "12px",
                textDecoration: "none",
              }}
            >
              忘记密码？
            </Link>
          </div>
        </Space>

        {/* 底部信息 */}
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "12px" }}>
            登录即表示同意我们的{" "}
            <span style={{ color: "#1890ff", cursor: "pointer" }}>服务条款</span> 和{" "}
            <span style={{ color: "#1890ff", cursor: "pointer" }}>隐私政策</span>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
