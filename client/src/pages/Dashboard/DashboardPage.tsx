import React, { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Button,
  Alert,
  Spin,
  Progress,
} from "antd";
import {
  WalletOutlined,
  MessageOutlined,
  PhoneOutlined,
  TrophyOutlined,
  ReloadOutlined,
  RiseOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { userApi, activationApi, rentalApi } from "../../services/api";
import { UserStats, Activation, Rental } from "../../types";

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActivations, setRecentActivations] = useState<Activation[]>([]);
  const [recentRentals, setRecentRentals] = useState<Rental[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 加载数据
  const loadData = async () => {
    try {
      const [statsResponse, activationsResponse, rentalsResponse] =
        await Promise.all([
          userApi.getStats(),
          activationApi.getList({ page: 1, limit: 5 }),
          rentalApi.getList({ page: 1, limit: 5 }),
        ]);

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (activationsResponse.success) {
        setRecentActivations(activationsResponse.data?.data || []);
      }

      if (rentalsResponse.success) {
        setRecentRentals(rentalsResponse.data?.data || []);
      }
    } catch (error) {
      console.error("加载仪表板数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 计算统计数据
  const totalActivations = stats
    ? Object.values(stats.activations).reduce(
        (sum, item) => sum + item.count,
        0
      )
    : 0;
  const totalRentals = stats
    ? Object.values(stats.rentals).reduce((sum, item) => sum + item.count, 0)
    : 0;
  const successActivations = stats
    ? (stats.activations["3"]?.count || 0) +
      (stats.activations["8"]?.count || 0)
    : 0;
  const successRate =
    totalActivations > 0
      ? Math.round((successActivations / totalActivations) * 100)
      : 0;

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
        }}
      >
        <Spin size="large" tip="正在加载仪表板..." />
      </div>
    );
  }

  return (
    <div style={{ padding: "0" }}>
      {/* 欢迎信息 */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0 }}>
              欢迎回来，{user?.username}！
            </Title>
            <Text type="secondary">
              今天是{" "}
              {new Date().toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={refreshing}
          >
            刷新数据
          </Button>
        </div>

        {/* 余额不足提醒 */}
        {user && user.balance < 2 && (
          <Alert
            message="余额不足提醒"
            description="您的账户余额较低，建议及时充值以确保服务正常使用。"
            type="warning"
            showIcon
            action={
              <Button
                size="small"
                onClick={() => navigate("/profile?tab=balance")}
              >
                立即充值
              </Button>
            }
            style={{ marginBottom: "16px" }}
          />
        )}
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="账户余额"
              value={
                user?.balance && typeof user.balance === "number"
                  ? user.balance
                  : 0
              }
              precision={2}
              prefix="$"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总激活次数"
              value={totalActivations}
              prefix={<MessageOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总租用次数"
              value={totalRentals}
              prefix={<PhoneOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="成功率"
              value={successRate}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{
                color:
                  successRate > 80
                    ? "#52c41a"
                    : successRate > 60
                    ? "#faad14"
                    : "#ff4d4f",
              }}
            />
            <Progress
              percent={successRate}
              showInfo={false}
              strokeColor={
                successRate > 80
                  ? "#52c41a"
                  : successRate > 60
                  ? "#faad14"
                  : "#ff4d4f"
              }
              style={{ marginTop: "8px" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card title="快速操作" style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Button
              type="primary"
              size="large"
              icon={<MessageOutlined />}
              onClick={() => navigate("/get-number")}
              block
            >
              获取验证码
            </Button>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              size="large"
              icon={<PhoneOutlined />}
              onClick={() => navigate("/rent-number")}
              block
            >
              租用号码
            </Button>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              size="large"
              icon={<WalletOutlined />}
              onClick={() => navigate("/profile?tab=balance")}
              block
            >
              账户充值
            </Button>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              size="large"
              icon={<RiseOutlined />}
              onClick={() => navigate("/profile?tab=stats")}
              block
            >
              查看统计
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 最近记录 */}
      <Row gutter={[16, 16]}>
        {/* 最近激活 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近激活"
            extra={
              <Button
                type="link"
                onClick={() => navigate("/activations")}
                style={{ padding: 0 }}
              >
                查看全部
              </Button>
            }
          >
            {recentActivations.length > 0 ? (
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                {recentActivations.map((activation) => (
                  <div
                    key={activation.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <Text strong>{activation.service_name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {activation.phone_number} • {activation.country_name}
                      </Text>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>
                        <Text
                          style={{
                            color:
                              activation.status === "3" ||
                              activation.status === "8"
                                ? "#52c41a"
                                : activation.status === "6"
                                ? "#ff4d4f"
                                : "#faad14",
                          }}
                        >
                          {activation.status_text}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        ${activation.cost}
                      </Text>
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: "#8c8c8c",
                }}
              >
                <MessageOutlined
                  style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                    opacity: 0.3,
                  }}
                />
                <div>暂无激活记录</div>
                <Button
                  type="link"
                  onClick={() => navigate("/get-number")}
                  style={{ padding: 0, marginTop: "8px" }}
                >
                  立即获取验证码
                </Button>
              </div>
            )}
          </Card>
        </Col>

        {/* 最近租用 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近租用"
            extra={
              <Button
                type="link"
                onClick={() => navigate("/rentals")}
                style={{ padding: 0 }}
              >
                查看全部
              </Button>
            }
          >
            {recentRentals.length > 0 ? (
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="middle"
              >
                {recentRentals.map((rental) => (
                  <div
                    key={rental.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <Text strong>{rental.service_name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {rental.phone_number} • {rental.duration_hours}小时
                      </Text>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>
                        <Text
                          style={{
                            color:
                              rental.status === "active"
                                ? "#52c41a"
                                : rental.status === "cancelled"
                                ? "#ff4d4f"
                                : "#8c8c8c",
                          }}
                        >
                          {rental.status_text}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {rental.sms_count} 条短信
                      </Text>
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0",
                  color: "#8c8c8c",
                }}
              >
                <ClockCircleOutlined
                  style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                    opacity: 0.3,
                  }}
                />
                <div>暂无租用记录</div>
                <Button
                  type="link"
                  onClick={() => navigate("/rent-number")}
                  style={{ padding: 0, marginTop: "8px" }}
                >
                  立即租用号码
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
