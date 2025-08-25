import React, { useState, useEffect } from "react";
import { Card, Typography, Tabs, message, Spin, Empty } from "antd";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate, useLocation } from "react-router-dom";
import { userApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import { useWebSocket } from "../../hooks/useWebSocket";
import { OverviewTab, ProfileTab, BalanceTab } from "./components";
import "./ProfilePage.css";

const { Title } = Typography;

interface UserProfile {
  id: number;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: "active" | "pending" | "suspended";
  balance: number;
  total_spent: number;
  total_recharged: number;
  created_at: string;
  last_login?: string;
  login_count: number;
  country?: string;
  timezone?: string;
  language?: string;
  two_factor_enabled: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  password_hash?: string;
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuthStore();
  const { isConnected } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);

  // Load profile data
  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  // Listen for WebSocket payment success events
  useEffect(() => {
    const handlePaymentSuccess = (event: CustomEvent) => {
      const data = event.detail;
      message.success(`充值成功！已到账 $${data.amount}`);
      loadProfileData();
      localStorage.removeItem("pendingPayment");
    };

    window.addEventListener("payment_success", handlePaymentSuccess as EventListener);

    return () => {
      window.removeEventListener("payment_success", handlePaymentSuccess as EventListener);
    };
  }, []);

  // Handle tab parameter from URL
  const getDefaultActiveTab = () => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get("tab");
    if (tab === "balance") return "balance";
    return "overview";
  };

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const response = await userApi.getProfile();
      if (response.success && response.data) {
        const profile = response.data as unknown as UserProfile;
        setProfileData(profile);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "加载个人资料失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    await loadProfileData();
    message.success("个人资料更新成功");
  };

  const handleFundsUpdate = async () => {
    await loadProfileData();
    message.success("充值成功！");
  };

  const items = [
    {
      key: "overview",
      label: "个人概览",
      children: (
        <OverviewTab
          user={user}
          profileData={profileData}
          onProfileUpdate={handleProfileUpdate}
          onFundsUpdate={handleFundsUpdate}
        />
      ),
    },
    {
      key: "profile",
      label: "账户管理",
      children: (
        <ProfileTab user={user} profileData={profileData} onProfileUpdate={handleProfileUpdate} />
      ),
    },
    {
      key: "balance",
      label: "充值",
      children: (
        <BalanceTab
          user={user}
          profileData={profileData}
          isConnected={isConnected}
          onFundsUpdate={handleFundsUpdate}
        />
      ),
    },
  ];

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description="请先登录" />
      </div>
    );
  }

  return (
    <div className="profile-container" style={{ padding: "24px" }}>
      <Title
        level={2}
        className="profile-title"
        style={{
          marginBottom: "24px",
          fontSize: "24px",
        }}
      >
        个人中心
      </Title>

      <Spin spinning={loading}>
        <Card>
          <Tabs
            items={items}
            defaultActiveKey={getDefaultActiveTab()}
            onChange={(activeKey) => {
              const searchParams = new URLSearchParams(location.search);
              if (activeKey === "overview") {
                searchParams.delete("tab");
              } else {
                searchParams.set("tab", activeKey);
              }
              navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
            }}
            size="large"
            tabPosition="top"
            style={{ minHeight: "600px" }}
            className="profile-tabs-responsive"
          />
        </Card>
      </Spin>
    </div>
  );
};

export default ProfilePage;
