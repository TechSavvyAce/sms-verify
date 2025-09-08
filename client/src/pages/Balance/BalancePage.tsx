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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      message.success(t("balance.paymentSuccess", { amount: data.amount }));
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
      message.error(getApiErrorMessage(error.response?.data?.error, t("balance.loadProfileError")));
    } finally {
      setLoading(false);
    }
  };

  const handleFundsUpdate = async () => {
    await loadProfileData();
    message.success(t("balance.fundsUpdateSuccess"));
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description={t("balance.pleaseLogin")} />
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
        {t("balance.accountRecharge")}
      </Title>

      <Spin spinning={loading}>
        <div>
          <Row gutter={[24, 24]}>
            {/* Balance Overview */}
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Card
                title={t("balance.balanceOverview")}
                extra={<WalletOutlined style={{ color: "#52c41a" }} />}
              >
                <Row gutter={[24, 16]}>
                  <Col xs={24} sm={8} md={8} lg={8} xl={8}>
                    <Statistic
                      title={t("balance.currentBalance")}
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
                      title={t("balance.totalRecharged")}
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
                      title={t("balance.totalSpent")}
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
                title={t("balance.addFunds")}
                extra={
                  <Space direction="horizontal" size="small" className="space-responsive">
                    <Badge
                      status={isConnected ? "success" : "error"}
                      text={isConnected ? t("balance.realTimeSync") : t("balance.offlineMode")}
                    />
                    <Text type="secondary" className="mobile-hide">
                      {t("balance.multiplePaymentMethods")}
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
                      <Title level={4}>{t("balance.quickRecharge")}</Title>
                      <Text type="secondary" style={{ display: "block", marginBottom: "16px" }}>
                        {t("balance.quickRechargeDescription")}
                      </Text>
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => setShowAddFundsModal(true)}
                        icon={<WalletOutlined />}
                        className="mobile-full-width"
                      >
                        {t("balance.rechargeNow")}
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
                      <Title level={4}>{t("balance.securePayment")}</Title>
                      <Text type="secondary" style={{ display: "block", marginBottom: "16px" }}>
                        {t("balance.securePaymentDescription")}
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
