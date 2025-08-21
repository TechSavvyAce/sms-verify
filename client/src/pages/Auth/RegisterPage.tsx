import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, Divider, Progress } from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { RegisterRequest } from "../../types";

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (values: RegisterRequest) => {
    setLoading(true);
    try {
      const result = await register(values);

      if (result?.requires_verification) {
        // Store email for verification page
        localStorage.setItem("registrationEmail", values.email);
        // Show success message and redirect to verification page
        navigate("/verify-email", {
          state: {
            message: "注册成功！请检查您的邮箱并点击验证链接激活账户。",
            email: values.email,
          },
        });
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Registration error:", error);
      // 错误已在 store 中处理
    } finally {
      setLoading(false);
    }
  };

  // 密码强度检测
  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;

    setPasswordStrength(strength);
    return strength;
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 50) return "#ff4d4f";
    if (strength < 75) return "#faad14";
    return "#52c41a";
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 25) return "弱";
    if (strength < 50) return "较弱";
    if (strength < 75) return "中等";
    return "强";
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
          maxWidth: "450px",
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
            注册账户
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "14px" }}>
            加入我们，开始使用专业的短信验证服务
          </Text>
        </div>

        {/* 注册表单 */}
        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" autoComplete="off">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, max: 50, message: "用户名长度为3-50个字符" },
              {
                pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
                message: "用户名只能包含字母、数字、下划线和中文",
              },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#1890ff" }} />}
              placeholder="用户名 (3-50字符)"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: "请输入邮箱地址" },
              { type: "email", message: "请输入有效的邮箱地址" },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: "#1890ff" }} />}
              placeholder="邮箱地址"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少6个字符" },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: "密码必须包含大小写字母和数字",
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#1890ff" }} />}
              placeholder="密码 (至少6位，包含大小写字母和数字)"
              autoComplete="new-password"
              onChange={(e) => checkPasswordStrength(e.target.value)}
            />
          </Form.Item>

          {/* 密码强度指示器 */}
          {passwordStrength > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <Text style={{ fontSize: "12px", color: "#8c8c8c" }}>密码强度</Text>
                <Text
                  style={{
                    fontSize: "12px",
                    color: getPasswordStrengthColor(passwordStrength),
                  }}
                >
                  {getPasswordStrengthText(passwordStrength)}
                </Text>
              </div>
              <Progress
                percent={passwordStrength}
                showInfo={false}
                strokeColor={getPasswordStrengthColor(passwordStrength)}
                size="small"
              />
            </div>
          )}

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
              prefix={<CheckCircleOutlined style={{ color: "#1890ff" }} />}
              placeholder="确认密码"
              autoComplete="new-password"
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
              立即注册
            </Button>
          </Form.Item>
        </Form>

        {/* 分隔线 */}
        <Divider>
          <Text style={{ color: "#8c8c8c", fontSize: "12px" }}>或</Text>
        </Divider>

        {/* 登录链接 */}
        <div style={{ textAlign: "center" }}>
          <Text style={{ color: "#8c8c8c" }}>
            已有账户？{" "}
            <Link
              to="/login"
              style={{
                color: "#1890ff",
                fontWeight: "500",
                textDecoration: "none",
              }}
            >
              立即登录
            </Link>
          </Text>
        </div>

        {/* 服务优势 */}
        <div
          style={{
            marginTop: "32px",
            padding: "16px",
            background: "#f9f9f9",
            borderRadius: "8px",
          }}
        >
          <Text strong style={{ display: "block", marginBottom: "8px", color: "#262626" }}>
            为什么选择我们？
          </Text>
          <ul
            style={{
              margin: 0,
              paddingLeft: "16px",
              color: "#8c8c8c",
              fontSize: "12px",
            }}
          >
            <li>全球多国手机号码资源</li>
            <li>快速稳定的短信接收</li>
            <li>透明的定价策略</li>
            <li>7×24小时技术支持</li>
          </ul>
        </div>

        {/* 底部信息 */}
        <div style={{ textAlign: "center", marginTop: "24px" }}>
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
