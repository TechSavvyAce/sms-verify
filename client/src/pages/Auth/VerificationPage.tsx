import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Typography, Divider, message, Radio } from "antd";
import { MailOutlined, SafetyOutlined, UserOutlined, MobileOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";

const { Title, Text } = Typography;

const VerificationPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verificationMethod, setVerificationMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  // 从导航状态或URL参数获取用户信息
  const { username, userId, accessToken, refreshToken } = location.state || {};

  // 如果没有导航状态，尝试从URL参数获取
  const urlParams = new URLSearchParams(location.search);
  const urlState = urlParams.get("state");

  let userDataFromUrl = null;
  if (urlState && !username) {
    try {
      userDataFromUrl = JSON.parse(atob(urlState));
    } catch (error) {
      console.error("Failed to parse URL state:", error);
    }
  }

  const finalUserData = location.state || userDataFromUrl || {};
  const {
    username: finalUsername,
    userId: finalUserId,
    accessToken: finalAccessToken,
    refreshToken: finalRefreshToken,
  } = finalUserData;

  const currentUser = user || { username: finalUsername, id: finalUserId, status: "pending" };

  // 添加调试信息
  console.log("VerificationPage - Component rendered with:", {
    locationState: location.state,
    urlState: urlState,
    userDataFromUrl: userDataFromUrl,
    finalUserData: finalUserData,
    authStoreUser: user,
    currentUser,
    finalUsername,
    finalUserId,
    finalAccessToken,
    finalRefreshToken,
  });

  useEffect(() => {
    console.log("VerificationPage - useEffect triggered with:", {
      username,
      userId,
      accessToken,
      refreshToken,
      user,
      isAuthenticated,
    });

    // 检查用户状态
    checkUserStatus();
  }, []); // 只在组件挂载时执行一次

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 8) {
      message.error("请输入8位验证码");
      return;
    }

    try {
      setLoading(true);
      console.log("VerificationPage - Starting verification with code:", verificationCode);

      // 发送邮箱验证，包含userId
      await authApi.verifyEmail(verificationCode);
      message.success("邮箱验证成功！您的账户已激活，正在跳转到仪表板...");

      // 更新本地存储的用户状态
      const currentUserData = JSON.parse(localStorage.getItem("user") || "{}");
      currentUserData.status = "active";
      currentUserData.email_verified = true;
      localStorage.setItem("user", JSON.stringify(currentUserData));

      // 延迟跳转到仪表板
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error: any) {
      console.error("VerificationPage - Verification failed:", error);
      const errorMsg =
        typeof error.error === "string" ? error.error : error.error?.message || "验证失败";
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerification = async () => {
    if (!phone) {
      message.error("请输入手机号码");
      return;
    }

    // 简单的手机号格式验证（支持国际格式）
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      message.error("请输入有效的国际手机号码格式（如：+8613800138000）");
      return;
    }

    try {
      setLoading(true);

      // 调用后端API验证手机号并激活账户
      const response = await authApi.verifyPhone(phone);

      if (response.success) {
        message.success("手机号码验证成功！账户已激活，正在跳转到仪表板...");

        // 更新本地存储的用户状态
        const currentUserData = JSON.parse(localStorage.getItem("user") || "{}");
        currentUserData.status = "active";
        currentUserData.phone_verified = true;
        currentUserData.phone = phone;
        localStorage.setItem("user", JSON.stringify(currentUserData));

        // 延迟跳转到仪表板
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } else {
        // 处理错误响应
        const errorMessage = typeof response.error === "string" ? response.error : "手机验证失败";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("VerificationPage - Phone verification failed:", error);
      let errorMsg = "手机验证失败，请稍后重试";

      if (typeof error === "string") {
        errorMsg = error;
      } else if (error?.error) {
        errorMsg = error.error;
      } else if (error?.message) {
        errorMsg = error.message;
      }

      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 尝试从localStorage获取用户信息
  const getUserFromStorage = () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        // 如果有token，尝试获取用户信息
        return { hasToken: true, token };
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error);
    }
    return { hasToken: false, token: null };
  };

  // 检查用户状态并决定下一步
  const checkUserStatus = async () => {
    console.log("VerificationPage - checkUserStatus called");

    // 如果有导航状态数据，直接使用，不需要API调用
    if (finalUsername && finalUserId && finalAccessToken && finalRefreshToken) {
      console.log("VerificationPage - Using navigation state data, proceeding with verification");

      // 保存token到localStorage以便后续使用
      localStorage.setItem("token", finalAccessToken);
      localStorage.setItem("refreshToken", finalRefreshToken);

      return;
    }

    // 如果没有导航状态，尝试从localStorage获取
    const { hasToken, token } = getUserFromStorage();
    console.log("VerificationPage - Storage check result:", { hasToken, token });

    if (hasToken && token) {
      try {
        console.log("VerificationPage - Attempting to fetch user profile");
        // 尝试获取用户资料
        const response = await authApi.getProfile();
        console.log("VerificationPage - Profile API response:", response);

        if (response.success && response.data) {
          const userData = response.data;
          console.log("VerificationPage - Retrieved user data:", userData);

          if (userData.status === "active") {
            console.log("VerificationPage - User is active, redirecting to dashboard");
            message.success("您的账户已激活，正在跳转到仪表板...");
            navigate("/dashboard");
            return;
          } else if (userData.status === "suspended") {
            console.log("VerificationPage - User is suspended, redirecting to register");
            message.error("账户已被停用，请联系客服");
            navigate("/register");
            return;
          } else if (userData.status === "pending") {
            // 用户状态正确，继续验证流程
            console.log("VerificationPage - User status is pending, proceeding with verification");
            return;
          }
        } else {
          console.log("VerificationPage - Profile API response not successful:", response);
        }
      } catch (error) {
        console.error("VerificationPage - Error fetching user profile:", error);
        // 如果获取用户资料失败，清除token并重定向到注册
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        message.error("会话已过期，请重新注册");
        navigate("/register");
        return;
      }
    } else {
      console.log("VerificationPage - No token found in storage");
    }

    // 如果没有token或获取用户资料失败，重定向到注册
    if (!currentUser?.username || !currentUser?.id) {
      console.log("VerificationPage - No currentUser data, redirecting to register");
      message.error("缺少用户信息，请重新注册");
      navigate("/register");
    } else {
      console.log("VerificationPage - CurrentUser data available:", currentUser);
    }
  };

  const handleSendVerificationCode = async () => {
    try {
      setSendingCode(true);

      if (!email) {
        message.error("请输入邮箱地址");
        return;
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        message.error("请输入有效的邮箱地址");
        return;
      }

      // 发送邮箱验证，包含userId
      await authApi.sendVerification(email, finalUserId);
      message.success("验证邮件已发送，请检查您的邮箱");
      setCodeSent(true);

      setCountdown(60); // 60秒倒计时
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || "发送失败，请重试";
      message.error(errorMessage);

      // 如果是网络错误，提供重试建议
      if (error.code === "NETWORK_ERROR" || error.message.includes("Network Error")) {
        message.info("网络连接异常，请检查网络后重试");
      }
    } finally {
      setSendingCode(false);
    }
  };

  // 如果有导航状态数据，直接显示验证页面
  if (finalUsername && finalUserId && finalAccessToken && finalRefreshToken) {
    console.log("VerificationPage - Rendering with navigation state data");
  } else if (currentUser?.username && currentUser?.id) {
    console.log("VerificationPage - Rendering with currentUser data");
  } else {
    console.log("VerificationPage - No user data available, not rendering");
    return null;
  }

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
            <SafetyOutlined />
          </div>
          <Title level={2} style={{ margin: 0, color: "#262626", fontWeight: "600" }}>
            账户验证
          </Title>
          <Text style={{ color: "#8c8c8c", fontSize: "16px", marginTop: "8px", display: "block" }}>
            请选择验证方式完成账户激活
          </Text>
        </div>

        {/* 用户信息 */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "32px",
            padding: "16px",
            background: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <Text strong style={{ fontSize: "16px", color: "#262626" }}>
            {finalUsername || currentUser?.username}
          </Text>
        </div>

        {/* 验证方式选择 */}
        <div style={{ marginBottom: "32px" }}>
          <Radio.Group
            value={verificationMethod}
            onChange={(e) => setVerificationMethod(e.target.value)}
            buttonStyle="solid"
            size="large"
          >
            <Radio.Button value="email">
              <MailOutlined /> 邮箱验证
            </Radio.Button>
            <Radio.Button value="phone">
              <MobileOutlined /> 手机验证
            </Radio.Button>
          </Radio.Group>
        </div>

        {/* 邮箱/手机输入 */}
        {verificationMethod === "email" ? (
          <Form.Item label="邮箱地址" style={{ marginBottom: "24px" }}>
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="large"
              disabled={codeSent && countdown > 0}
            />
          </Form.Item>
        ) : (
          <Form.Item label="手机号码" style={{ marginBottom: "24px" }}>
            <Input
              prefix={<MobileOutlined />}
              placeholder="请输入国际手机号码（如：+8613800138000）"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              size="large"
            />
          </Form.Item>
        )}

        {/* 发送验证码按钮 - 仅邮箱验证需要 */}
        {verificationMethod === "email" && (
          <Button
            type="primary"
            icon={<MailOutlined />}
            onClick={handleSendVerificationCode}
            loading={sendingCode}
            disabled={countdown > 0}
            size="large"
            block
            style={{
              marginBottom: "24px",
              height: "48px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "500",
            }}
          >
            {countdown > 0 ? `${countdown}s` : `发送邮箱验证码`}
          </Button>
        )}

        {/* 手机验证按钮 - 立即验证 */}
        {verificationMethod === "phone" && (
          <Button
            type="primary"
            icon={<MobileOutlined />}
            onClick={handlePhoneVerification}
            loading={loading}
            size="large"
            block
            style={{
              marginBottom: "24px",
              height: "48px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "500",
            }}
          >
            验证手机号码并激活账户
          </Button>
        )}

        {/* 验证码输入表单 - 只在发送验证码后显示 */}
        {codeSent && (
          <div style={{ marginTop: "24px" }}>
            <Form.Item name="verificationCode" style={{ marginBottom: "24px" }}>
              <Input
                prefix={<SafetyOutlined style={{ color: "#1890ff" }} />}
                placeholder="输入8位验证码"
                size="large"
                style={{ height: "48px", fontSize: "16px" }}
                maxLength={8}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={!codeSent}
              />
            </Form.Item>

            {/* 验证按钮 */}
            <Button
              type="primary"
              icon={<SafetyOutlined />}
              onClick={handleVerifyCode}
              loading={loading}
              disabled={verificationCode.length !== 8}
              block
              size="large"
              style={{
                height: "48px",
                fontSize: "16px",
                fontWeight: "500",
                borderRadius: "8px",
                marginBottom: "16px",
              }}
            >
              验证并激活账户
            </Button>
          </div>
        )}

        {/* 分隔线 */}
        <Divider style={{ margin: "32px 0" }}>
          <Text style={{ color: "#bfbfbf", fontSize: "14px" }}>或</Text>
        </Divider>

        {/* 其他选项 */}
        <div style={{ textAlign: "center" }}>
          <Text style={{ color: "#8c8c8c", fontSize: "14px" }}>
            已有账户？{" "}
            <a
              href="/login"
              style={{
                color: "#1890ff",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              立即登录
            </a>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default VerificationPage;
