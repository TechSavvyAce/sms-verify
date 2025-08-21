import React from "react";
import { Card, Alert, Button, Typography, Space, Divider, message } from "antd";
import { MailOutlined, ReloadOutlined, LogoutOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { authApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";

const { Title, Text, Paragraph } = Typography;

const EmailVerificationPrompt: React.FC = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  const handleResendEmail = async () => {
    try {
      if (!user?.email) {
        message.error("无法获取邮箱地址");
        return;
      }

      // 调用重新发送验证邮件的API
      const response = await authApi.resendVerificationEmail(user.email);

      if (response.success) {
        message.success("验证邮件已重新发送，请检查您的邮箱");
      } else {
        message.error(getApiErrorMessage(response.error, "重新发送失败，请稍后重试"));
      }
    } catch (error: any) {
      message.error("重新发送失败：" + (error.message || "未知错误"));
    }
  };

  if (!user || user.status === "active") {
    return null;
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "600px",
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card style={{ width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <MailOutlined style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }} />
          <Title level={2}>请验证您的邮箱</Title>
        </div>

        <Alert
          message="账户状态：待验证"
          description="您的账户已创建，但需要验证邮箱后才能使用完整功能。"
          type="info"
          showIcon
          style={{ marginBottom: "24px" }}
        />

        <div style={{ marginBottom: "24px" }}>
          <Paragraph>
            我们已向 <strong>{user.email}</strong> 发送了验证邮件。
          </Paragraph>

          <Paragraph>
            请检查您的邮箱（包括垃圾邮件文件夹），并点击验证链接来激活您的账户。
          </Paragraph>
        </div>

        <Divider />

        <div style={{ marginBottom: "24px" }}>
          <Title level={4}>没有收到验证邮件？</Title>
          <Paragraph>请检查：</Paragraph>
          <ul>
            <li>邮箱地址是否正确</li>
            <li>是否在垃圾邮件文件夹中</li>
            <li>等待几分钟后重试</li>
          </ul>
        </div>

        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleResendEmail}
            block
            size="large"
          >
            重新发送验证邮件
          </Button>

          <Button icon={<LogoutOutlined />} onClick={handleLogout} block>
            退出登录
          </Button>
        </Space>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Text type="secondary">验证成功后，您将自动跳转到仪表板页面。</Text>
        </div>
      </Card>
    </div>
  );
};

export default EmailVerificationPrompt;
