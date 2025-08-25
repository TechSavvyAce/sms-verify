import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Divider,
  message,
  Radio,
  Space,
  Alert,
  Select,
} from "antd";
import {
  MailOutlined,
  MobileOutlined,
  SafetyOutlined,
  UserOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import Flag from "react-flagkit";
import countryData from "../../data/countries_flag.json";

const { Title, Text } = Typography;
const { Option } = Select;

// 国家代码和国旗数据 - 从JSON文件加载并转换为RegExp对象
const countryOptions = countryData.map((country) => ({
  ...country,
  pattern: new RegExp(country.pattern),
}));

const VerificationPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verificationMethod, setVerificationMethod] = useState<"email" | "sms">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(countryOptions[0]); // 默认选择中国
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
    if (verificationCode.length !== 8) {
      message.error("请输入完整的8位验证码");
      return;
    }

    try {
      setLoading(true);
      console.log("VerificationPage - Starting verification with code:", verificationCode);

      if (verificationMethod === "email") {
        console.log("VerificationPage - Verifying email with code");
        const response = await authApi.verifyEmail(verificationCode);
        console.log("VerificationPage - Email verification response:", response);

        if (response.success) {
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
        } else {
          const errorMsg =
            typeof response.error === "string"
              ? response.error
              : response.error?.message || "验证失败";
          throw new Error(errorMsg);
        }
      } else {
        console.log("VerificationPage - Verifying SMS with code");
        // Use the full phone number with country code for verification
        const fullPhone = selectedCountry.code + phone;
        const response = await authApi.verifySMS(fullPhone, verificationCode);
        console.log("VerificationPage - SMS verification response:", response);

        if (response.success) {
          message.success("手机验证成功！您的账户已激活，正在跳转到仪表板...");

          // 更新本地存储的用户状态
          const currentUserData = JSON.parse(localStorage.getItem("user") || "{}");
          currentUserData.status = "active";
          currentUserData.phone_verified = true;
          localStorage.setItem("user", JSON.stringify(currentUserData));

          // 延迟跳转到仪表板
          setTimeout(() => {
            navigate("/dashboard");
          }, 2000);
        } else {
          const errorMsg =
            typeof response.error === "string"
              ? response.error
              : response.error?.message || "验证失败";
          throw new Error(errorMsg);
        }
      }
    } catch (error: any) {
      console.error("VerificationPage - Verification failed:", error);
      const errorMessage = error.response?.data?.error || error.message || "验证失败，请重试";
      message.error(errorMessage);

      // 清空验证码，让用户重新输入
      setVerificationCode("");

      // 提供具体的错误指导
      if (errorMessage.includes("过期") || errorMessage.includes("expired")) {
        message.info("验证码已过期，请重新发送");
      } else if (errorMessage.includes("无效") || errorMessage.includes("invalid")) {
        message.info("验证码无效，请检查后重新输入");
      } else if (error.code === "NETWORK_ERROR" || error.message.includes("Network Error")) {
        message.info("网络连接异常，请检查网络后重试");
      }
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

      if (verificationMethod === "email") {
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
      } else {
        if (!phone) {
          message.error("请输入手机号码");
          return;
        }

        // 验证手机号格式（使用选中国家的验证规则）
        const fullPhone = selectedCountry.code + phone;
        if (!selectedCountry.pattern.test(phone)) {
          message.error(`请输入有效的${selectedCountry.name}手机号码`);
          return;
        }

        console.log("VerificationPage - Sending SMS verification with:", {
          phone: fullPhone,
          userId: finalUserId,
          finalUserData,
          currentUser,
        });

        await authApi.sendSMSVerification(fullPhone, finalUserId);
        console.log("VerificationPage - SMS verification code sent successfully");
        message.success(`验证码已发送到您的手机 ${fullPhone}`);
        setCodeSent(true);
      }

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
            <Radio.Button value="sms">
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
          <div style={{ marginBottom: "24px" }}>
            <Text strong style={{ display: "block", marginBottom: "8px", color: "#262626" }}>
              手机号码
            </Text>
            <Input
              prefix={<MobileOutlined style={{ color: "#8c8c8c" }} />}
              addonBefore={
                <Select
                  value={selectedCountry.code}
                  style={{
                    width: "auto",
                    minWidth: "70px",
                    border: "none",
                    backgroundColor: "transparent",
                  }}
                  bordered={false}
                  onChange={(value) => {
                    const newCountry = countryOptions.find((c) => c.code === value);
                    if (newCountry) {
                      setSelectedCountry(newCountry);
                      setPhone("");
                    }
                  }}
                  dropdownStyle={{ minWidth: "200px" }}
                  disabled={codeSent && countdown > 0}
                >
                  {countryOptions.map((country) => (
                    <Option key={country.code} value={country.code}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Flag country={country.flag} size={16} />
                        <span style={{ fontSize: "14px" }}>{country.code}</span>
                      </div>
                    </Option>
                  ))}
                </Select>
              }
              placeholder="请输入手机号码"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              size="large"
              disabled={codeSent && countdown > 0}
              style={{
                borderRadius: "8px",
              }}
            />
          </div>
        )}

        {/* 发送验证码按钮 */}
        <Button
          type="primary"
          icon={verificationMethod === "email" ? <MailOutlined /> : <MobileOutlined />}
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
          {countdown > 0
            ? `${countdown}s`
            : `发送${verificationMethod === "email" ? "邮箱" : "手机"}验证码`}
        </Button>

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
