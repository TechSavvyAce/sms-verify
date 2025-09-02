import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Badge,
  message,
  Spin,
  Empty,
} from "antd";
import { WalletOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { userApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import { useWebSocket } from "../../hooks/useWebSocket";
import AddFundsModal from "../../components/Common/AddFundsModal";
import "./BalancePage.css";

const { Title, Text } = Typography;

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

const BalancePage: React.FC = () => {
  const { user } = useAuthStore();
  const { isConnected } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);

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

  const handleFundsUpdate = async () => {
    await loadProfileData();
    message.success("充值成功！");
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description="请先登录" />
      </div>
    );
  }

  return (
    <div className="balance-container" style={{ padding: "24px" }}>
      <Title
        level={2}
        className="balance-title"
        style={{
          marginBottom: "24px",
          fontSize: "24px",
        }}
      >
        账户充值
      </Title>

      <Spin spinning={loading}>
        <div>
          <Row gutter={[24, 24]}>
            {/* Balance Overview */}
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Card title="余额概览" extra={<WalletOutlined style={{ color: "#52c41a" }} />}>
                <Row gutter={[24, 16]}>
                  <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                    <Statistic
                      title="当前余额"
                      value={profileData?.balance || user?.balance || 0}
                      precision={2}
                      prefix="$"
                      valueStyle={{
                        color: "#3f8600",
                      }}
                      className="statistic-value-large"
                    />
                  </Col>
                  <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                    <Statistic
                      title="累计充值"
                      value={profileData?.total_recharged || user?.total_recharged || 0}
                      precision={2}
                      prefix="$"
                      valueStyle={{
                        color: "#1890ff",
                      }}
                      className="statistic-value-medium"
                    />
                  </Col>
                  <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                    <Statistic
                      title="累计消费"
                      value={profileData?.total_spent || user?.total_spent || 0}
                      precision={2}
                      prefix="$"
                      valueStyle={{
                        color: "#cf1322",
                      }}
                      className="statistic-value-medium"
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Add Funds Section */}
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Card
                title="充值"
                extra={
                  <Space direction="horizontal" size="small" className="space-responsive">
                    <Badge
                      status={isConnected ? "success" : "error"}
                      text={isConnected ? "实时同步" : "离线模式"}
                    />
                    <Text type="secondary" className="mobile-hide">
                      支持多种支付方式
                    </Text>
                  </Space>
                }
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <div style={{ textAlign: "center", padding: "24px" }}>
                      <WalletOutlined
                        style={{
                          color: "#1890ff",
                          marginBottom: "16px",
                        }}
                        className="wallet-icon-large"
                      />
                      <Title level={4}>快速充值</Title>
                      <Text type="secondary" style={{ display: "block", marginBottom: "16px" }}>
                        选择充值金额，使用安全支付方式完成充值
                      </Text>
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => setShowAddFundsModal(true)}
                        icon={<WalletOutlined />}
                        className="mobile-full-width"
                      >
                        立即充值
                      </Button>
                    </div>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <div style={{ textAlign: "center", padding: "24px" }}>
                      <SafetyCertificateOutlined
                        style={{
                          color: "#52c41a",
                          marginBottom: "16px",
                        }}
                        className="wallet-icon-large"
                      />
                      <Title level={4}>安全支付</Title>
                      <Text type="secondary" style={{ display: "block", marginBottom: "16px" }}>
                        使用safeping.xyz进行安全的加密货币支付
                      </Text>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* Add Funds Modal */}
          <AddFundsModal
            visible={showAddFundsModal}
            onCancel={() => setShowAddFundsModal(false)}
            onSuccess={(amount) => {
              setShowAddFundsModal(false);
              handleFundsUpdate();
            }}
            currentBalance={
              (typeof profileData?.balance === "number" && !isNaN(profileData.balance)
                ? profileData.balance
                : 0) ||
              (typeof user?.balance === "number" && !isNaN(user.balance) ? user.balance : 0) ||
              0
            }
          />
        </div>
      </Spin>
    </div>
  );
};

export default BalancePage;
