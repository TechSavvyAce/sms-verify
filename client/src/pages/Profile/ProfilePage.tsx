import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Tabs,
  Avatar,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Tag,
  Divider,
  List,
  Timeline,
  Badge,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Alert,
  Progress,
  Tooltip,
  Popconfirm,
  message,
  Spin,
  Empty,
  Descriptions,
  Upload,
  Image,
} from "antd";
import {
  UserOutlined,
  WalletOutlined,
  SecurityScanOutlined,
  HistoryOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CameraOutlined,
  LockOutlined,
  BellOutlined,
  SafetyOutlined,
  KeyOutlined,
  GlobalOutlined,
  MobileOutlined,
  MailOutlined,
  CalendarOutlined,
  TrophyOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate, useLocation } from "react-router-dom";
import { userApi, paymentApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import { useWebSocket } from "../../hooks/useWebSocket";

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

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
}

interface ActivityLog {
  id: number;
  action: string;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  status: "success" | "failed" | "warning";
}

interface SecuritySettings {
  password_changed_at?: string;
  last_password_reset?: string;
  failed_login_attempts: number;
  account_locked_until?: string;
  trusted_devices: number;
  api_keys_count: number;
}

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuthStore();
  const { isConnected } = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [profileForm] = Form.useForm();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);

  // Load profile data
  useEffect(() => {
    if (user) {
      loadProfileData();
      loadActivityLogs();
      loadSecuritySettings();
    }
  }, [user]);

  // Listen for WebSocket payment success events
  useEffect(() => {
    const handlePaymentSuccess = (event: CustomEvent) => {
      const data = event.detail;
      message.success(`充值成功！已到账 $${data.amount}`);

      // Refresh profile data to show updated balance
      loadProfileData();

      // Close payment modal if open
      setShowAddFundsModal(false);

      // Clear pending payment
      localStorage.removeItem("pendingPayment");
    };

    // Add event listener for custom payment success event
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
        setProfileData(response.data as unknown as UserProfile);
        profileForm.setFieldsValue(response.data);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "加载个人资料失败"));
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    try {
      const response = await userApi.getActivityLogs();
      if (response.data?.success) {
        setActivityLogs(response.data.data || []);
      }
    } catch (error: any) {
      console.error("加载活动日志失败:", error);
    }
  };

  const loadSecuritySettings = async () => {
    try {
      const response = await userApi.getSecuritySettings();
      if (response.data?.success) {
        setSecuritySettings(response.data.data);
      }
    } catch (error: any) {
      console.error("加载安全设置失败:", error);
    }
  };

  const handleProfileUpdate = async (values: any) => {
    try {
      setLoading(true);
      const formData = new FormData();

      // Add form values
      Object.keys(values).forEach((key) => {
        if (values[key] !== undefined && values[key] !== null) {
          formData.append(key, values[key]);
        }
      });

      // Add avatar if selected
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const response = await userApi.updateProfile(formData);

      if (response.success) {
        message.success("个人资料更新成功");
        setEditMode(false);
        setAvatarFile(null);
        setAvatarPreview("");
        await loadProfileData();
        if (response.data) {
          updateUser(response.data);
        }
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "更新个人资料失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (info: any) => {
    if (info.file.status === "done") {
      setAvatarFile(info.file.originFileObj);
      setAvatarPreview(URL.createObjectURL(info.file.originFileObj));
    }
  };

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

  const getActivityIcon = (action: string | undefined) => {
    if (!action) return <HistoryOutlined />;
    if (action.includes("login")) return <UserOutlined />;
    if (action.includes("password")) return <LockOutlined />;
    if (action.includes("profile")) return <EditOutlined />;
    if (action.includes("payment")) return <WalletOutlined />;
    return <HistoryOutlined />;
  };

  const getActivityColor = (status: string | undefined) => {
    if (!status) return "blue";
    switch (status) {
      case "success":
        return "green";
      case "failed":
        return "red";
      case "warning":
        return "orange";
      default:
        return "blue";
    }
  };

  const items = [
    {
      key: "overview",
      label: (
        <span>
          <UserOutlined />
          个人概览
        </span>
      ),
      children: (
        <div>
          <Row gutter={[24, 24]}>
            {/* Profile Header */}
            <Col span={24}>
              <Card>
                <Row gutter={24} align="middle">
                  <Col>
                    <Avatar
                      size={80}
                      src={avatarPreview || profileData?.avatar}
                      icon={<UserOutlined />}
                    />
                  </Col>
                  <Col flex="1">
                    <Title level={3} style={{ margin: 0 }}>
                      {profileData?.username || user?.username}
                    </Title>
                    <Space>
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
                  </Col>
                  <Col>
                    <Space>
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => setEditMode(true)}
                      >
                        编辑资料
                      </Button>
                      <Button icon={<CameraOutlined />}>更换头像</Button>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Statistics */}
            <Col span={6}>
              <Card>
                <Statistic
                  title="账户余额"
                  value={profileData?.balance || user?.balance || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#3f8600" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="累计消费"
                  value={profileData?.total_spent || user?.total_spent || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#cf1322" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="累计充值"
                  value={profileData?.total_recharged || user?.total_recharged || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="登录次数"
                  value={profileData?.login_count || 0}
                  suffix="次"
                  valueStyle={{ color: "#722ed1" }}
                />
              </Card>
            </Col>

            {/* Account Progress */}
            <Col span={24}>
              <Card title="账户进度" extra={<TrophyOutlined style={{ color: "#faad14" }} />}>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Progress
                        type="circle"
                        percent={profileData?.status === "active" ? 100 : 50}
                        format={(percent) => `${percent}%`}
                        strokeColor={profileData?.status === "active" ? "#52c41a" : "#faad14"}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text strong>账户状态</Text>
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Progress
                        type="circle"
                        percent={profileData?.two_factor_enabled ? 100 : 0}
                        format={(percent) => `${percent}%`}
                        strokeColor={profileData?.two_factor_enabled ? "#52c41a" : "#d9d9d9"}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text strong>双重认证</Text>
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Progress
                        type="circle"
                        percent={profileData?.avatar ? 100 : 0}
                        format={(percent) => `${percent}%`}
                        strokeColor={profileData?.avatar ? "#52c41a" : "#d9d9d9"}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text strong>头像设置</Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "profile",
      label: (
        <span>
          <EditOutlined />
          个人资料
        </span>
      ),
      children: (
        <div>
          {editMode ? (
            <Card
              title="编辑个人资料"
              extra={
                <Space>
                  <Button onClick={() => setEditMode(false)} icon={<CloseOutlined />}>
                    取消
                  </Button>
                  <Button
                    type="primary"
                    loading={loading}
                    onClick={() => profileForm.submit()}
                    icon={<SaveOutlined />}
                  >
                    保存
                  </Button>
                </Space>
              }
            >
              <Form
                form={profileForm}
                layout="vertical"
                onFinish={handleProfileUpdate}
                initialValues={profileData || {}}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="username"
                      label="用户名"
                      rules={[{ required: true, message: "请输入用户名" }]}
                    >
                      <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label="邮箱地址"
                      rules={[
                        { required: true, message: "请输入邮箱地址" },
                        { type: "email", message: "请输入有效的邮箱地址" },
                      ]}
                    >
                      <Input prefix={<MailOutlined />} placeholder="请输入邮箱地址" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="phone" label="手机号码">
                      <Input prefix={<MobileOutlined />} placeholder="请输入手机号码" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="country" label="国家/地区">
                      <Select placeholder="请选择国家/地区">
                        <Option value="CN">中国</Option>
                        <Option value="US">美国</Option>
                        <Option value="JP">日本</Option>
                        <Option value="KR">韩国</Option>
                        <Option value="RU">俄罗斯</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="timezone" label="时区">
                      <Select placeholder="请选择时区">
                        <Option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</Option>
                        <Option value="America/New_York">America/New_York (UTC-5)</Option>
                        <Option value="Europe/London">Europe/London (UTC+0)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="language" label="语言">
                      <Select placeholder="请选择语言">
                        <Option value="zh-CN">简体中文</Option>
                        <Option value="en-US">English</Option>
                        <Option value="ja-JP">日本語</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="头像">
                  <Upload
                    name="avatar"
                    listType="picture-card"
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleAvatarChange}
                  >
                    {avatarPreview ? (
                      <Image src={avatarPreview} alt="avatar" style={{ width: "100%" }} />
                    ) : (
                      <div>
                        <CameraOutlined />
                        <div style={{ marginTop: 8 }}>上传头像</div>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              </Form>
            </Card>
          ) : (
            <Card title="个人资料详情">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="用户名">
                  {profileData?.username || user?.username}
                </Descriptions.Item>
                <Descriptions.Item label="邮箱地址">
                  {profileData?.email || user?.email}
                </Descriptions.Item>
                <Descriptions.Item label="手机号码">
                  {profileData?.phone || "未设置"}
                </Descriptions.Item>
                <Descriptions.Item label="国家/地区">
                  {profileData?.country || "未设置"}
                </Descriptions.Item>
                <Descriptions.Item label="时区">
                  {profileData?.timezone || "未设置"}
                </Descriptions.Item>
                <Descriptions.Item label="语言">
                  {profileData?.language || "未设置"}
                </Descriptions.Item>
                <Descriptions.Item label="注册时间">
                  {profileData?.created_at
                    ? new Date(profileData.created_at).toLocaleString()
                    : "未知"}
                </Descriptions.Item>
                <Descriptions.Item label="最后登录">
                  {profileData?.last_login
                    ? new Date(profileData.last_login).toLocaleString()
                    : "从未登录"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: "balance",
      label: (
        <span>
          <WalletOutlined />
          账户余额
        </span>
      ),
      children: (
        <div>
          <Row gutter={[24, 24]}>
            {/* Balance Overview */}
            <Col span={24}>
              <Card title="余额概览" extra={<WalletOutlined style={{ color: "#52c41a" }} />}>
                <Row gutter={24}>
                  <Col span={8}>
                    <Statistic
                      title="当前余额"
                      value={profileData?.balance || user?.balance || 0}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: "#3f8600", fontSize: "32px" }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="累计充值"
                      value={profileData?.total_recharged || user?.total_recharged || 0}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: "#1890ff", fontSize: "24px" }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="累计消费"
                      value={profileData?.total_spent || user?.total_spent || 0}
                      precision={2}
                      prefix="$"
                      valueStyle={{ color: "#cf1322", fontSize: "24px" }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Add Funds Section */}
            <Col span={24}>
              <Card
                title="充值"
                extra={
                  <Space>
                    <Badge
                      status={isConnected ? "success" : "error"}
                      text={isConnected ? "实时同步" : "离线模式"}
                    />
                    <Text type="secondary">支持多种支付方式</Text>
                  </Space>
                }
              >
                <Row gutter={[24, 24]}>
                  <Col span={12}>
                    <div style={{ textAlign: "center", padding: "24px" }}>
                      <WalletOutlined
                        style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }}
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
                      >
                        立即充值
                      </Button>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="充值说明">
                      <ul style={{ paddingLeft: "20px", margin: 0 }}>
                        <li>充值金额将立即到账</li>
                        <li>支持SafePing安全支付</li>
                        <li>支付成功后自动更新余额</li>
                        <li>充值记录可在交易记录中查看</li>
                        <li>如有问题请联系客服</li>
                      </ul>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Recent Transactions */}
            <Col span={24}>
              <Card
                title="最近交易记录"
                extra={
                  <Button type="link" onClick={() => navigate("/transactions")}>
                    查看全部
                  </Button>
                }
              >
                <Empty description="暂无交易记录" />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "security",
      label: (
        <span>
          <SecurityScanOutlined />
          安全设置
        </span>
      ),
      children: (
        <div>
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Card title="双重认证" extra={<SafetyOutlined />}>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <Badge
                    status={profileData?.two_factor_enabled ? "success" : "default"}
                    text={profileData?.two_factor_enabled ? "已启用" : "未启用"}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Button
                      type={profileData?.two_factor_enabled ? "default" : "primary"}
                      icon={<KeyOutlined />}
                    >
                      {profileData?.two_factor_enabled ? "管理双重认证" : "启用双重认证"}
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="登录安全" extra={<LockOutlined />}>
                <List
                  size="small"
                  dataSource={[
                    {
                      title: "密码最后修改",
                      value: securitySettings?.password_changed_at
                        ? new Date(securitySettings.password_changed_at).toLocaleDateString()
                        : "从未修改",
                    },
                    {
                      title: "失败登录次数",
                      value: securitySettings?.failed_login_attempts || 0,
                    },
                    {
                      title: "受信任设备",
                      value: securitySettings?.trusted_devices || 0,
                    },
                    {
                      title: "API密钥数量",
                      value: securitySettings?.api_keys_count || 0,
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <Text type="secondary">{item.title}:</Text>
                      <Text strong style={{ marginLeft: 8 }}>
                        {item.value}
                      </Text>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            <Col span={24}>
              <Card title="通知设置" extra={<BellOutlined />}>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Switch
                        checked={profileData?.email_notifications}
                        onChange={async (checked) => {
                          try {
                            await userApi.updateNotifications({ email_notifications: checked });
                            message.success("邮件通知设置已更新");
                            await loadProfileData();
                          } catch (error: any) {
                            message.error(
                              getApiErrorMessage(
                                error.response?.data?.error,
                                "更新邮件通知设置失败"
                              )
                            );
                          }
                        }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text>邮件通知</Text>
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Switch
                        checked={profileData?.sms_notifications}
                        onChange={async (checked) => {
                          try {
                            await userApi.updateNotifications({ sms_notifications: checked });
                            message.success("短信通知设置已更新");
                            await loadProfileData();
                          } catch (error: any) {
                            message.error(
                              getApiErrorMessage(
                                error.response?.data?.error,
                                "更新短信通知设置失败"
                              )
                            );
                          }
                        }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text>短信通知</Text>
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Switch
                        checked={profileData?.push_notifications}
                        onChange={async (checked) => {
                          try {
                            await userApi.updateNotifications({ push_notifications: checked });
                            message.success("推送通知设置已更新");
                            await loadProfileData();
                          } catch (error: any) {
                            message.error(
                              getApiErrorMessage(
                                error.response?.data?.error,
                                "更新推送通知设置失败"
                              )
                            );
                          }
                        }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text>推送通知</Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "activity",
      label: (
        <span>
          <HistoryOutlined />
          活动记录
        </span>
      ),
      children: (
        <div>
          <Card title="账户活动记录" extra={<GlobalOutlined />}>
            {activityLogs.length > 0 ? (
              <Timeline>
                {activityLogs.map((log) => (
                  <Timeline.Item
                    key={log.id}
                    color={getActivityColor(log.status)}
                    dot={getActivityIcon(log.action)}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>{log.description}</Text>
                      <Tag color={getActivityColor(log.status)} style={{ marginLeft: 8 }}>
                        {log.status}
                      </Tag>
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      <Text type="secondary">
                        {new Date(log.created_at).toLocaleString()} | IP: {log.ip_address}
                      </Text>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Empty description="暂无活动记录" />
            )}
          </Card>
        </div>
      ),
    },
  ];

  // Add Funds Modal
  const AddFundsModal = () => {
    const [amount, setAmount] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [paymentUrl, setPaymentUrl] = useState<string>("");
    const [paymentData, setPaymentData] = useState<any>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<string>("");

    const handleCreatePayment = async () => {
      try {
        setLoading(true);

        // Call SafePing directly from frontend
        const response = await fetch("https://www.safeping.xyz/api/payment/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            service_name: "SMS验证平台充值",
            description: `用户 ${user?.username} 充值 $${amount}`,
            amount: amount,
            webhook_url: `${window.location.origin}/api/payment/webhook?user_id=${user?.id}`,
            language: "zh-CN",
          }),
        });

        const data = await response.json();

        if (data.payment_url && data.payment_id) {
          setPaymentUrl(data.payment_url);
          setPaymentData(data);
          setShowPayment(true);
          // Store payment info locally for tracking
          localStorage.setItem(
            "pendingPayment",
            JSON.stringify({
              payment_id: data.payment_id,
              amount: amount,
              user_id: user?.id,
              created_at: new Date().toISOString(),
              expires_at: data.expires_at,
            })
          );

          // Show success message
          message.success(`支付订单创建成功！订单号: ${data.payment_id}`);
        } else {
          message.error("创建支付失败，请重试");
        }
      } catch (error) {
        console.error("Payment creation error:", error);
        message.error("网络错误，请重试");
      } finally {
        setLoading(false);
      }
    };

    const handlePaymentSuccess = () => {
      message.success("充值成功！");
      setShowAddFundsModal(false);
      setShowPayment(false);
      setPaymentUrl("");
      setPaymentData(null);
      loadProfileData();
    };

    // Auto-close payment modal when WebSocket receives payment success
    useEffect(() => {
      const handlePaymentComplete = () => {
        if (showPayment) {
          setShowPayment(false);
          setPaymentUrl("");
        }
      };

      window.addEventListener("payment_success", handlePaymentComplete);
      return () => window.removeEventListener("payment_success", handlePaymentComplete);
    }, [showPayment]);

    // Countdown timer for payment expiration
    useEffect(() => {
      if (paymentData?.expires_at && showPayment) {
        const timer = setInterval(() => {
          const now = new Date().getTime();
          const expiresAt = new Date(paymentData.expires_at).getTime();
          const remaining = expiresAt - now;

          if (remaining <= 0) {
            setTimeRemaining("已过期");
            clearInterval(timer);
            // Auto-close modal after expiration
            setTimeout(() => {
              setShowPayment(false);
              setPaymentUrl("");
              setPaymentData(null);
              message.warning("支付订单已过期，请重新创建");
            }, 2000);
          } else {
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            setTimeRemaining(
              `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
            );
          }
        }, 1000);

        return () => clearInterval(timer);
      }
    }, [paymentData?.expires_at, showPayment]);

    return (
      <Modal
        title="充值账户"
        open={showAddFundsModal}
        onCancel={() => {
          setShowAddFundsModal(false);
          setShowPayment(false);
          setPaymentUrl("");
        }}
        footer={null}
        width={600}
      >
        {!showPayment ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <WalletOutlined
                style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }}
              />
              <Title level={4}>选择充值金额</Title>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
              {[10, 25, 50, 100, 200, 500].map((value) => (
                <Col span={8} key={value}>
                  <Button
                    type={amount === value ? "primary" : "default"}
                    size="large"
                    block
                    onClick={() => setAmount(value)}
                    style={{ height: "60px", fontSize: "16px" }}
                  >
                    ${value}
                  </Button>
                </Col>
              ))}
            </Row>

            <div style={{ marginBottom: "24px" }}>
              <Text strong>自定义金额：</Text>
              <Input
                type="number"
                min={1}
                max={10000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                addonBefore="$"
                style={{ marginTop: "8px" }}
              />
            </div>

            <div style={{ textAlign: "center" }}>
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleCreatePayment}
                disabled={amount < 1}
                style={{ width: "200px" }}
              >
                确认充值 ${amount}
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: "24px" }}>
              <Title level={4}>请完成支付</Title>
              <Text type="secondary">请选择以下任一方式完成支付，支付成功后余额将自动到账</Text>
            </div>

            <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
              {/* Payment URL Option */}
              <Col span={12}>
                <Card size="small" title="方式一：直接支付链接">
                  <div style={{ marginBottom: "16px" }}>
                    <Text type="secondary">点击下方按钮在新窗口中打开支付页面</Text>
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={() => window.open(paymentUrl, "_blank")}
                    icon={<WalletOutlined />}
                  >
                    打开支付页面
                  </Button>
                </Card>
              </Col>

              {/* QR Code Option */}
              <Col span={12}>
                <Card size="small" title="方式二：手机扫码支付">
                  <div style={{ marginBottom: "16px" }}>
                    <Text type="secondary">使用手机扫描下方二维码完成支付</Text>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <Image
                      src="data:image/png;base64,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"
                      alt="支付二维码"
                      width={120}
                      height={120}
                      style={{ border: "1px solid #d9d9d9", borderRadius: "8px" }}
                    />
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Payment Status and Info */}
            <Card size="small" title="支付信息" style={{ marginBottom: "24px" }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div>
                    <Text strong>订单号：</Text>
                    <Text copyable style={{ fontFamily: "monospace" }}>
                      {paymentData?.payment_id || "N/A"}
                    </Text>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>支付金额：</Text>
                    <Text type="success" style={{ fontSize: "16px" }}>
                      ${amount}
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <Text strong>过期时间：</Text>
                    <Text type="warning">
                      {paymentData?.expires_at
                        ? new Date(paymentData.expires_at).toLocaleString("zh-CN")
                        : "N/A"}
                    </Text>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>剩余时间：</Text>
                    <Text type="danger" style={{ fontSize: "16px", fontWeight: "bold" }}>
                      {timeRemaining || "计算中..."}
                    </Text>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>服务名称：</Text>
                    <Text>{paymentData?.service_name || "N/A"}</Text>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Payment Instructions */}
            <Card size="small" title="支付说明" style={{ marginBottom: "24px" }}>
              <ul style={{ textAlign: "left", paddingLeft: "20px", margin: 0 }}>
                <li>支付链接：点击"打开支付页面"在新窗口中完成支付</li>
                <li>手机扫码：使用手机扫描二维码，在手机上完成支付</li>
                <li>支付成功后，系统将自动更新您的账户余额</li>
                <li>如遇问题，请联系客服并提供订单号</li>
                <li>支付订单将在过期时间后自动失效，请及时完成支付</li>
              </ul>
            </Card>

            <Space>
              <Button onClick={() => setShowPayment(false)}>返回选择金额</Button>
              <Button
                onClick={() => {
                  loadProfileData();
                  message.info("正在检查支付状态...");
                }}
                icon={<ReloadOutlined />}
              >
                检查支付状态
              </Button>
              <Button type="primary" onClick={handlePaymentSuccess}>
                我已完成支付
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    );
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description="请先登录" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        个人中心
      </Title>

      <Spin spinning={loading}>
        <Card>
          <Tabs
            items={items}
            defaultActiveKey={getDefaultActiveTab()}
            onChange={(activeKey) => {
              // Update URL when tab changes
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
          />
        </Card>
      </Spin>

      {/* Render the Add Funds Modal */}
      <AddFundsModal />
    </div>
  );
};

export default ProfilePage;
