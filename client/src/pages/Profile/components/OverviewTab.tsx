import React, { useState } from "react";
import { Card, Typography, Avatar, Row, Col, Statistic, Button, Space, Tag } from "antd";
import {
  UserOutlined,
  WalletOutlined,
  EditOutlined,
  CameraOutlined,
  LockOutlined,
  MailOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import SetPasswordModal from "../../../components/Common/SetPasswordModal";
import AddFundsModal from "../../../components/Common/AddFundsModal";

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

interface OverviewTabProps {
  user: any;
  profileData: UserProfile | null;
  onProfileUpdate: () => void;
  onFundsUpdate: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  user,
  profileData,
  onProfileUpdate,
  onFundsUpdate,
}) => {
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "default";
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "suspended":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string | undefined) => {
    if (!status) return "未知";
    switch (status) {
      case "active":
        return "正常";
      case "pending":
        return "待验证";
      case "suspended":
        return "已暂停";
      default:
        return "未知";
    }
  };

  return (
    <div>
      <Row gutter={[24, 24]}>
        {/* Profile Header */}
        <Col xs={24} sm={24} md={24} lg={24} xl={24}>
          <Card>
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} sm={24} md={4} lg={3} xl={2}>
                <div className="profile-avatar-container">
                  <Avatar
                    size={80}
                    src={profileData?.avatar}
                    icon={<UserOutlined />}
                    className="profile-avatar-responsive"
                  />
                </div>
              </Col>
              <Col xs={24} sm={24} md={16} lg={18} xl={20}>
                <div className="profile-info-container">
                  <Title level={3} style={{ margin: 0 }} className="profile-title-responsive">
                    {profileData?.username || user?.username}
                  </Title>
                  <Space wrap className="profile-tags-container">
                    <Tag color={getStatusColor(profileData?.status || user?.status)}>
                      {getStatusText(profileData?.status || user?.status)}
                    </Tag>
                    <Tag color="blue">
                      <MailOutlined /> {profileData?.email || user?.email}
                    </Tag>
                    {profileData?.phone && (
                      <Tag color="green">
                        <MobileOutlined /> {profileData.phone}
                      </Tag>
                    )}
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      注册时间：
                      {profileData?.created_at
                        ? new Date(profileData.created_at).toLocaleDateString()
                        : "未知"}
                    </Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={24} md={4} lg={3} xl={2}>
                <div className="profile-actions-container">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={onProfileUpdate}
                      size="middle"
                      block={false}
                      className="mobile-full-width"
                    >
                      编辑资料
                    </Button>
                    <Button
                      icon={<CameraOutlined />}
                      size="middle"
                      block={false}
                      className="mobile-full-width"
                    >
                      更换头像
                    </Button>
                  </Space>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Statistics */}
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card>
            <Statistic
              title="账户余额"
              value={profileData?.balance || user?.balance || 0}
              precision={2}
              prefix="$"
              valueStyle={{
                color: "#3f8600",
              }}
              className="statistic-value-responsive"
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card>
            <Statistic
              title="累计充值"
              value={profileData?.total_recharged || user?.total_recharged || 0}
              precision={2}
              prefix="$"
              valueStyle={{
                color: "#1890ff",
              }}
              className="statistic-value-responsive"
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card>
            <Statistic
              title="累计消费"
              value={profileData?.total_spent || user?.total_spent || 0}
              precision={2}
              prefix="$"
              valueStyle={{
                color: "#cf1322",
              }}
              className="statistic-value-responsive"
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card>
            <Statistic
              title="登录次数"
              value={profileData?.login_count || 0}
              valueStyle={{
                color: "#722ed1",
              }}
              className="statistic-value-responsive"
            />
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} sm={24} md={24} lg={24} xl={24}>
          <Card title="快速操作">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Button
                  type="primary"
                  size="large"
                  icon={<WalletOutlined />}
                  onClick={() => setShowAddFundsModal(true)}
                  block
                >
                  立即充值
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Button
                  size="large"
                  icon={<LockOutlined />}
                  onClick={() => setShowSetPasswordModal(true)}
                  block
                >
                  设置密码
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Button size="large" icon={<EditOutlined />} onClick={onProfileUpdate} block>
                  编辑资料
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Modals */}
      <SetPasswordModal
        visible={showSetPasswordModal}
        onCancel={() => setShowSetPasswordModal(false)}
        onSuccess={() => {
          setShowSetPasswordModal(false);
          onProfileUpdate();
        }}
        username={user?.username || ""}
      />

      <AddFundsModal
        visible={showAddFundsModal}
        onCancel={() => setShowAddFundsModal(false)}
        onSuccess={(amount) => {
          setShowAddFundsModal(false);
          onFundsUpdate();
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
  );
};

export default OverviewTab;
