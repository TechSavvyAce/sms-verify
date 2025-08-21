import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Card, Alert, Button, Typography, Result, Spin, Input } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import { getApiErrorMessage } from "../../utils/errorHelpers";

const { Title, Text, Paragraph } = Typography;

const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuthStore();
  const [verificationStatus, setVerificationStatus] = useState<"verifying" | "success" | "error">(
    "verifying"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string>("");
  const [manualEmail, setManualEmail] = useState<string>("");
  const [showManualEmailInput, setShowManualEmailInput] = useState(false);
  const hasVerificationAttempted = useRef(false); // Use ref to track if verification has been attempted

  useEffect(() => {
    // If already successfully verified, do nothing more.
    if (verificationStatus === "success") {
      return;
    }

    // Prevent multiple API calls from Strict Mode or re-renders
    if (hasVerificationAttempted.current) {
      console.log("Verification already attempted, skipping API call.");
      return;
    }

    hasVerificationAttempted.current = true; // Mark that verification has been initiated

    const verifyEmail = async () => {
      try {
        const token = searchParams.get("token");

        if (!token) {
          setVerificationStatus("error");
          setErrorMessage("验证链接无效，缺少验证令牌。");
          setIsLoading(false);
          return;
        }

        console.log("Calling verifyEmail API with token:", token);
        const response = await authApi.verifyEmail(token);
        console.log("API Response:", response);

        if (response.success) {
          setVerificationStatus("success");
          if (response.data?.user) {
            updateUser(response.data.user);
          }
          setTimeout(() => {
            navigate("/login", {
              state: {
                message: "邮箱验证成功！请使用您的账户登录。",
              },
            });
          }, 3000);
        } else {
          setVerificationStatus("error");
          setErrorMessage(getApiErrorMessage(response.error, "邮箱验证失败，请重试。"));
        }
      } catch (error: any) {
        setVerificationStatus("error");
        // 安全地提取错误消息，避免渲染错误对象
        const errorMessage = error?.message || error?.error || "验证过程中发生错误，请重试。";
        setErrorMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [searchParams, navigate, updateUser, verificationStatus]); // Keep verificationStatus in dependencies to re-evaluate if it changes

  const handleResendVerification = async () => {
    try {
      setIsResending(true);
      setResendMessage("");

      // Get email from URL params
      let email = searchParams.get("email");

      // If no email in URL, try to get it from localStorage (from registration)
      if (!email) {
        email = localStorage.getItem("registrationEmail");
      }

      // If still no email, use manual input
      if (!email && manualEmail) {
        email = manualEmail;
      }

      if (!email) {
        setResendMessage("请输入邮箱地址");
        setShowManualEmailInput(true);
        return;
      }

      const response = await authApi.resendVerificationEmail(email);

      if (response.success) {
        setResendMessage("✅ 验证邮件已重新发送，请检查您的邮箱（包括垃圾邮件文件夹）");
        // Store the email for future use
        localStorage.setItem("registrationEmail", email);
        // Hide manual email input after successful send
        setShowManualEmailInput(false);
      } else {
        setResendMessage(getApiErrorMessage(response.error, "重新发送失败，请稍后重试"));
      }
    } catch (error: any) {
      setResendMessage(getApiErrorMessage(error.response?.data?.error, "重新发送失败，请稍后重试"));
    } finally {
      setIsResending(false);
    }
  };

  if (isLoading) {
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
        <Card style={{ width: "100%", textAlign: "center" }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} size="large" />
          <div style={{ marginTop: "24px" }}>
            <Title level={3}>正在验证邮箱...</Title>
            <Text type="secondary">请稍候，我们正在处理您的验证请求。</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (verificationStatus === "success") {
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
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
            title="邮箱验证成功！"
            subTitle="您的账户已成功激活，现在可以使用所有功能了。"
            extra={[
              <Button type="primary" key="login" onClick={() => navigate("/login")}>
                立即登录
              </Button>,
              <Button key="home" onClick={() => navigate("/")}>
                返回首页
              </Button>,
            ]}
          />
          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <Text type="secondary">页面将在3秒后自动跳转到登录页面...</Text>
          </div>
        </Card>
      </div>
    );
  }

  if (verificationStatus === "error") {
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
          {/* Show welcome message if coming from registration */}
          {location.state?.message && (
            <Alert
              message="注册成功"
              description={location.state.message}
              type="success"
              showIcon
              style={{ marginBottom: "24px" }}
            />
          )}

          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
            title="邮箱验证失败"
            subTitle={errorMessage}
            extra={[
              <Button type="primary" key="login" onClick={() => navigate("/login")}>
                返回登录
              </Button>,
              <Button key="home" onClick={() => navigate("/")}>
                返回首页
              </Button>,
            ]}
          />

          {/* Resend Verification Section */}
          <div style={{ textAlign: "center", marginTop: "24px", marginBottom: "24px" }}>
            {showManualEmailInput && (
              <div style={{ marginBottom: "16px" }}>
                <Input
                  placeholder="请输入您的邮箱地址"
                  value={manualEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setManualEmail(e.target.value)
                  }
                  style={{ width: "300px", marginRight: "8px" }}
                  onPressEnter={handleResendVerification}
                />
              </div>
            )}
            <Button
              type="primary"
              loading={isResending}
              onClick={handleResendVerification}
              style={{ marginBottom: "16px" }}
            >
              重新发送验证邮件
            </Button>
            {!showManualEmailInput && (
              <Button
                type="link"
                onClick={() => setShowManualEmailInput(true)}
                style={{ marginLeft: "8px" }}
              >
                手动输入邮箱
              </Button>
            )}
            {resendMessage && (
              <div style={{ marginTop: "8px" }}>
                <Text type={resendMessage.includes("成功") ? "success" : "danger"}>
                  {resendMessage}
                </Text>
              </div>
            )}
          </div>

          <Alert
            message="常见问题"
            description={
              <div>
                <Paragraph>
                  <strong>验证链接无效？</strong>
                </Paragraph>
                <ul>
                  <li>验证链接可能已过期（24小时后过期）</li>
                  <li>链接可能被截断或损坏</li>
                  <li>请尝试重新发送验证邮件或联系客服</li>
                  <li>如果收不到邮件，请检查垃圾邮件文件夹</li>
                  <li>确保邮箱地址输入正确</li>
                </ul>
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: "24px" }}
          />
        </Card>
      </div>
    );
  }

  return null;
};

export default EmailVerificationPage;
