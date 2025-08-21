import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Tabs,
  Badge,
  Progress,
  DatePicker,
  Popconfirm,
  Avatar,
  Alert,
  Empty,
  Divider,
  Switch,
  InputNumber,
  Descriptions,
} from "antd";
import {
  UserOutlined,
  WalletOutlined,
  SettingOutlined,
  BarChartOutlined,
  ReloadOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  BellOutlined,
  DatabaseOutlined,
  CloudOutlined,
  SecurityScanOutlined,
} from "@ant-design/icons";
import { adminApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import { useWebSocket } from "../../hooks/useWebSocket";
import { SystemStats, Transaction } from "../../types";
import { useLocation, useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Helper function to safely format currency values
const formatCurrency = (value: any): string => {
  if (typeof value === "number") {
    return value.toFixed(2);
  }
  return parseFloat(value || 0).toFixed(2);
};

// Using the existing SystemStats interface from types

interface User {
  id: number;
  username: string;
  email: string;
  status: "active" | "pending" | "suspended";
  balance: number;
  total_recharged: number;
  total_spent: number;
  created_at: string;
  last_login?: string;
  login_count: number;
}

// Using the existing Transaction interface from types

interface AdminDashboardProps {
  activeTab?: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab: propActiveTab }) => {
  const { isConnected } = useWebSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [activeTab, setActiveTab] = useState(propActiveTab || "overview");
  const [backupLoading, setBackupLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationForm] = Form.useForm();

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Set initial active tab based on URL or prop
  useEffect(() => {
    const path = location.pathname;
    let tabToSet = propActiveTab || "overview";

    if (path.includes("/admin/users")) {
      tabToSet = "users";
    } else if (path.includes("/admin/system")) {
      tabToSet = "settings";
    } else if (path.includes("/admin/dashboard")) {
      tabToSet = "overview";
    }

    setActiveTab(tabToSet);

    // Load data for specific tabs
    if (tabToSet === "users" && users.length === 0) {
      loadUsers();
    } else if (tabToSet === "transactions" && !transactions) {
      loadTransactions();
    }
  }, [location.pathname, propActiveTab]);

  // Handle tab changes
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const routeMap: { [key: string]: string } = {
      overview: "/admin/dashboard",
      users: "/admin/users",
      transactions: "/admin/dashboard", // Keep transactions in dashboard for now
      settings: "/admin/system",
    };
    navigate(routeMap[key] || "/admin/dashboard");

    // Load specific data for each tab
    if (key === "users" && users.length === 0) {
      loadUsers();
    } else if (key === "transactions" && !transactions) {
      loadTransactions();
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const statsResponse = await adminApi.getStats();

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data as SystemStats);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "加载仪表板数据失败"));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersResponse = await adminApi.getUsers();

      if (usersResponse.success && usersResponse.data?.data) {
        setUsers(usersResponse.data.data);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "加载用户数据失败"));
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const transactionsResponse = await adminApi.getTransactions();

      if (transactionsResponse.success && transactionsResponse.data?.data) {
        setTransactions(transactionsResponse.data.data);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "加载交易数据失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusChange = async (userId: number, status: string, reason?: string) => {
    try {
      const response = await adminApi.updateUserStatus(userId, status, reason);
      if (response.success) {
        message.success("用户状态更新成功");
        loadDashboardData();
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "更新用户状态失败"));
    }
  };

  const handleBalanceAdjustment = async (
    userId: number,
    amount: number,
    type: "add" | "subtract",
    description: string
  ) => {
    try {
      const response = await adminApi.adjustBalance(userId, amount, type, description);
      if (response.success) {
        message.success("余额调整成功");
        loadDashboardData();
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "余额调整失败"));
    }
  };

  const handleDatabaseBackup = async () => {
    try {
      setBackupLoading(true);
      const response = await adminApi.createBackup();
      if (response.success) {
        message.success(`数据库备份已开始，备份ID: ${response.data.backup_id}`);
      } else {
        message.error("数据库备份失败");
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "数据库备份失败"));
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSendNotification = async (values: any) => {
    try {
      setNotificationLoading(true);
      const response = await adminApi.sendNotification({
        title: values.title,
        message: values.message,
        type: values.type,
        target_users: values.target_users,
      });
      if (response.success) {
        message.success("系统通知已发送");
        setShowNotificationModal(false);
        notificationForm.resetFields();
      } else {
        message.error("发送通知失败");
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "发送通知失败"));
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleSystemHealthCheck = async () => {
    try {
      setHealthCheckLoading(true);
      const response = await adminApi.systemHealthCheck();
      if (response.success) {
        const status = response.data.status;
        if (status === "healthy") {
          message.success("系统检查完成，所有服务运行正常");
        } else {
          message.warning(`系统检查完成，状态: ${status}`);
        }
      } else {
        message.error("系统检查失败");
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "系统检查失败"));
    } finally {
      setHealthCheckLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const getStatusText = (status: string) => {
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

  // System health functions removed - using simplified status display

  const userColumns = [
    {
      title: "用户ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "头像",
      key: "avatar",
      width: 60,
      render: () => <Avatar icon={<UserOutlined />} />,
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      ellipsis: true,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>,
    },
    {
      title: "余额",
      dataIndex: "balance",
      key: "balance",
      render: (balance: any) => (
        <Text type="success" strong>
          ${formatCurrency(balance)}
        </Text>
      ),
    },
    {
      title: "累计充值",
      dataIndex: "total_recharged",
      key: "total_recharged",
      render: (amount: any) => <Text strong>${formatCurrency(amount)}</Text>,
    },
    {
      title: "注册时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: "最后登录",
      dataIndex: "last_login",
      key: "last_login",
      render: (date: string) => (date ? new Date(date).toLocaleDateString() : "从未登录"),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: any, record: User) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setShowUserModal(true);
            }}
          >
            查看
          </Button>
          <Button
            size="small"
            icon={<WalletOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setShowUserModal(true);
            }}
          >
            余额
          </Button>
          {record.status === "active" ? (
            <Popconfirm
              title="确定要暂停此用户吗？"
              onConfirm={() => handleUserStatusChange(record.id, "suspended", "管理员操作")}
            >
              <Button size="small" icon={<LockOutlined />} danger>
                暂停
              </Button>
            </Popconfirm>
          ) : (
            <Button
              size="small"
              icon={<UnlockOutlined />}
              onClick={() => handleUserStatusChange(record.id, "active")}
            >
              激活
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const transactionColumns = [
    {
      title: "交易ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (type: string) => {
        const typeMap = {
          recharge: { text: "充值", color: "success" },
          activation: { text: "激活", color: "warning" },
          rental: { text: "租用", color: "info" },
          refund: { text: "退款", color: "default" },
        };
        const config = typeMap[type as keyof typeof typeMap] || { text: type, color: "default" };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      render: (amount: any, record: Transaction) => (
        <Text type={record.type === "recharge" ? "success" : "danger"} strong>
          ${formatCurrency(amount)}
        </Text>
      ),
    },
    {
      title: "余额变化",
      key: "balance_change",
      render: (_: any, record: Transaction) => (
        <div>
          <div>前: ${formatCurrency(record.balance_before)}</div>
          <div>后: ${formatCurrency(record.balance_after)}</div>
        </div>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: any, record: Transaction) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTransaction(record);
              setShowTransactionModal(true);
            }}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const items = [
    {
      key: "overview",
      label: (
        <span>
          <BarChartOutlined />
          系统概览
        </span>
      ),
      children: (
        <div>
          {/* System Health Alert */}
          {stats && (
            <Alert
              message="系统状态: 运行中"
              description={`统计周期: ${stats.period_days} 天 | 总用户: ${stats.users.total} | 总营收: $${formatCurrency(stats.financial.total_revenue)}`}
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          {/* Key Statistics */}
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总用户数"
                  value={stats?.users.total || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="活跃用户"
                  value={stats?.users.by_status.active || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总营收"
                  value={stats?.financial.total_revenue || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#3f8600" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="本月营收"
                  value={stats?.financial.net_revenue || 0}
                  precision={2}
                  prefix="$"
                  valueStyle={{ color: "#faad14" }}
                />
              </Card>
            </Col>
          </Row>

          {/* System Progress */}
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card title="用户状态分布">
                <div style={{ textAlign: "center" }}>
                  <Progress
                    type="circle"
                    percent={
                      stats
                        ? Math.round((stats.users.by_status.active / stats.users.total) * 100)
                        : 0
                    }
                    format={(percent) => `${percent}%`}
                    strokeColor="#52c41a"
                  />
                  <div style={{ marginTop: 16 }}>
                    <Text>活跃用户率</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="激活状态">
                <div style={{ textAlign: "center" }}>
                  <Progress
                    type="circle"
                    percent={
                      stats
                        ? Math.round(
                            ((stats.activations.by_status["1"]?.count || 0) /
                              (stats.activations.total || 1)) *
                              100
                          )
                        : 0
                    }
                    format={(percent) => `${percent}%`}
                    strokeColor="#52c41a"
                  />
                  <div style={{ marginTop: 16 }}>
                    <Text>成功激活率</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="WebSocket状态">
                <div style={{ textAlign: "center" }}>
                  <Badge
                    status={isConnected ? "success" : "error"}
                    text={isConnected ? "已连接" : "未连接"}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Text>实时通信</Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Quick Actions */}
          <Card title="快速操作">
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={loadDashboardData}>
                刷新数据
              </Button>
              <Button
                icon={<DatabaseOutlined />}
                onClick={handleDatabaseBackup}
                loading={backupLoading}
              >
                数据库备份
              </Button>
              <Button icon={<CloudOutlined />} onClick={() => navigate("/admin/system")}>
                系统配置
              </Button>
              <Button icon={<BellOutlined />} onClick={() => setShowNotificationModal(true)}>
                发送通知
              </Button>
              <Button icon={<UserOutlined />} onClick={() => navigate("/admin/users")}>
                用户管理
              </Button>
              <Button icon={<WalletOutlined />} onClick={() => navigate("/admin/transactions")}>
                交易管理
              </Button>
              <Button
                icon={<SecurityScanOutlined />}
                onClick={handleSystemHealthCheck}
                loading={healthCheckLoading}
              >
                系统检查
              </Button>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: "users",
      label: (
        <span>
          <UserOutlined />
          用户管理
        </span>
      ),
      children: (
        <div>
          <Card
            title="用户列表"
            extra={
              <Space>
                <RangePicker
                  onChange={(dates) => {
                    if (dates) {
                      setDateRange([dates[0]!.toISOString(), dates[1]!.toISOString()]);
                    } else {
                      setDateRange(null);
                    }
                  }}
                />
                <Button icon={<ReloadOutlined />} onClick={loadUsers}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              loading={loading}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "transactions",
      label: (
        <span>
          <WalletOutlined />
          交易管理
        </span>
      ),
      children: (
        <div>
          <Card
            title="交易记录"
            extra={
              <Space>
                <RangePicker
                  onChange={(dates) => {
                    if (dates) {
                      setDateRange([dates[0]!.toISOString(), dates[1]!.toISOString()]);
                    } else {
                      setDateRange(null);
                    }
                  }}
                />
                <Button icon={<ReloadOutlined />} onClick={loadTransactions}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Table
              columns={transactionColumns}
              dataSource={transactions || []}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              loading={loading}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "settings",
      label: (
        <span>
          <SettingOutlined />
          系统设置
        </span>
      ),
      children: (
        <div>
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Card title="基本配置">
                <Form layout="vertical">
                  <Form.Item label="平台名称">
                    <Input defaultValue="SMS验证平台" />
                  </Form.Item>
                  <Form.Item label="维护模式">
                    <Switch defaultChecked={false} />
                  </Form.Item>
                  <Form.Item label="注册开放">
                    <Switch defaultChecked={true} />
                  </Form.Item>
                  <Form.Item label="邮件验证">
                    <Switch defaultChecked={true} />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="安全设置">
                <Form layout="vertical">
                  <Form.Item label="登录失败限制">
                    <InputNumber min={1} max={10} defaultValue={5} />
                  </Form.Item>
                  <Form.Item label="会话超时(分钟)">
                    <InputNumber min={15} max={1440} defaultValue={120} />
                  </Form.Item>
                  <Form.Item label="密码最小长度">
                    <InputNumber min={6} max={20} defaultValue={8} />
                  </Form.Item>
                  <Form.Item label="强制双重认证">
                    <Switch defaultChecked={false} />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        管理员控制台
      </Title>

      <Spin spinning={loading}>
        {/* Show only the overview content */}
        {items[0].children}
      </Spin>

      {/* User Detail Modal */}
      <Modal
        title="用户详情"
        open={showUserModal}
        onCancel={() => setShowUserModal(false)}
        footer={null}
        width={800}
      >
        {selectedUser && (
          <div>
            <Row gutter={24}>
              <Col span={12}>
                <Card size="small" title="基本信息">
                  <Descriptions column={1}>
                    <Descriptions.Item label="用户ID">{selectedUser.id}</Descriptions.Item>
                    <Descriptions.Item label="用户名">{selectedUser.username}</Descriptions.Item>
                    <Descriptions.Item label="邮箱">{selectedUser.email}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={getStatusColor(selectedUser.status)}>
                        {getStatusText(selectedUser.status)}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="注册时间">
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后登录">
                      {selectedUser.last_login
                        ? new Date(selectedUser.last_login).toLocaleString()
                        : "从未登录"}
                    </Descriptions.Item>
                    <Descriptions.Item label="登录次数">
                      {selectedUser.login_count}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="财务信息">
                  <Descriptions column={1}>
                    <Descriptions.Item label="当前余额">
                      <Text type="success" strong style={{ fontSize: "18px" }}>
                        ${formatCurrency(selectedUser.balance)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="累计充值">
                      <Text strong>${formatCurrency(selectedUser.total_recharged)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="累计消费">
                      <Text type="danger">${formatCurrency(selectedUser.total_spent)}</Text>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider />

                  <Form layout="vertical">
                    <Form.Item label="余额调整">
                      <Space>
                        <InputNumber
                          placeholder="金额"
                          min={0.01}
                          step={0.01}
                          precision={2}
                          style={{ width: 120 }}
                          id="balance-amount"
                        />
                        <Select defaultValue="add" style={{ width: 80 }} id="balance-type">
                          <Option value="add">增加</Option>
                          <Option value="subtract">减少</Option>
                        </Select>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            const amount = (
                              document.getElementById("balance-amount") as HTMLInputElement
                            )?.value;
                            const type = (
                              document.getElementById("balance-type") as HTMLSelectElement
                            )?.value;
                            if (amount && type && selectedUser) {
                              handleBalanceAdjustment(
                                selectedUser.id,
                                parseFloat(amount),
                                type as "add" | "subtract",
                                `管理员${type === "add" ? "增加" : "减少"}余额`
                              );
                            }
                          }}
                        >
                          调整
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal
        title="交易详情"
        open={showTransactionModal}
        onCancel={() => setShowTransactionModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowTransactionModal(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedTransaction ? (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="交易ID">{selectedTransaction.id}</Descriptions.Item>
            <Descriptions.Item label="类型">{selectedTransaction.type}</Descriptions.Item>
            <Descriptions.Item label="金额">
              ${formatCurrency(selectedTransaction.amount)}
            </Descriptions.Item>
            <Descriptions.Item label="余额变化">
              <div>前: ${formatCurrency(selectedTransaction.balance_before)}</div>
              <div>后: ${formatCurrency(selectedTransaction.balance_after)}</div>
            </Descriptions.Item>
            <Descriptions.Item label="描述">{selectedTransaction.description}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedTransaction.created_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="未选择交易" />
        )}
      </Modal>

      {/* Notification Modal */}
      <Modal
        title="发送系统通知"
        open={showNotificationModal}
        onCancel={() => setShowNotificationModal(false)}
        footer={null}
        width={600}
      >
        <Form
          form={notificationForm}
          layout="vertical"
          onFinish={handleSendNotification}
          initialValues={{
            title: "",
            message: "",
            type: "info",
            target_users: "all",
          }}
        >
          <Form.Item
            label="通知标题"
            name="title"
            rules={[{ required: true, message: "请输入通知标题" }]}
          >
            <Input placeholder="请输入通知标题" />
          </Form.Item>

          <Form.Item
            label="通知内容"
            name="message"
            rules={[{ required: true, message: "请输入通知内容" }]}
          >
            <Input.TextArea placeholder="请输入通知内容" rows={4} />
          </Form.Item>

          <Form.Item label="通知类型" name="type">
            <Select>
              <Option value="info">信息</Option>
              <Option value="warning">警告</Option>
              <Option value="error">错误</Option>
              <Option value="success">成功</Option>
            </Select>
          </Form.Item>

          <Form.Item label="目标用户" name="target_users">
            <Select>
              <Option value="all">所有用户</Option>
              <Option value="active">活跃用户</Option>
              <Option value="vip">VIP用户</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={notificationLoading}>
                发送通知
              </Button>
              <Button onClick={() => setShowNotificationModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
