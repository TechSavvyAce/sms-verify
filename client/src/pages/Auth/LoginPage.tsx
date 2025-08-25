import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, Divider, message, Space } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  LoginOutlined,
} from "@ant-design/icons";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

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
      navigate("/dashboard");
    } catch (error: any) {
      // 检查是否是账户验证相关的错误
      if (error.message === "账户尚未激活，请先完成验证") {
        // 可以在这里提供验证选项或跳转到验证页面
        message.info("请完成账户验证后再登录");
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
            <UserOutlined />
          </div>
          <Title level={2} style={{ margin: 0, color: "#262626", fontWeight: "600" }}>
            欢迎回来
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "16px", marginTop: "8px", display: "block" }}>
            使用用户名和密码登录
          </Text>
        </div>

        {/* 登录表单 */}
        <Form form={form} layout="vertical" onFinish={handleLogin} size="large" autoComplete="off">
          {/* 用户名 */}
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, message: "用户名至少3个字符" },
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
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#1890ff" }} />}
              placeholder="密码"
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
              登录
            </Button>
          </Form.Item>
        </Form>

        {/* 分隔线 */}
        <Divider style={{ margin: "32px 0" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "14px" }}>或</Text>
        </Divider>

        {/* 其他选项 */}
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {/* 注册链接 */}
          <div style={{ textAlign: "center" }}>
            <Text style={{ color: "#8c8c8c", fontSize: "16px" }}>
              还没有账户？{" "}
              <Link
                to="/register"
                style={{
                  color: "#1890ff",
                  fontWeight: "600",
                  textDecoration: "none",
                  fontSize: "16px",
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
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              忘记密码？
            </Link>
          </div>
        </Space>

        {/* 底部信息 */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
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
