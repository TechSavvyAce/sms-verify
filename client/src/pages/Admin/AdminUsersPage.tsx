import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
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
  Popconfirm,
  Avatar,
  Descriptions,
  Divider,
  InputNumber,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  UserOutlined,
  ReloadOutlined,
  LockOutlined,
  UnlockOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import { adminApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import "./AdminPage.css";

const { Title, Text } = Typography;
const { Option } = Select;

// Helper function to safely format currency values
const formatCurrency = (value: any): string => {
  if (typeof value === "number") {
    return value.toFixed(2);
  }
  return parseFloat(value || 0).toFixed(2);
};

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

const AdminUsersPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Get the appropriate locale for date formatting based on current language
  const getDateLocale = () => {
    return currentLanguage === "zh-CN" ? "zh-CN" : "en-US";
  };

  // Load users data
  useEffect(() => {
    loadUsers();
  }, []);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

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

  const handleUserStatusChange = async (userId: number, status: string, reason?: string) => {
    try {
      const response = await adminApi.updateUserStatus(userId, status, reason);
      if (response.success) {
        message.success("用户状态更新成功");
        loadUsers();
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
        loadUsers();
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "余额调整失败"));
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

  // Mobile card component
  const UserCard: React.FC<{ user: User }> = ({ user }) => (
    <Card size="small" className="admin-user-card" style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
        <Avatar icon={<UserOutlined />} style={{ marginRight: "12px" }} />
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: "14px" }}>
            {user.username}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            ID: {user.id}
          </Text>
        </div>
        <Tag color={getStatusColor(user.status)} style={{ fontSize: "11px" }}>
          {getStatusText(user.status)}
        </Tag>
      </div>

      <Row gutter={[8, 8]} style={{ marginBottom: "12px" }}>
        <Col span={8}>
          <Statistic
            title="余额"
            value={formatCurrency(user.balance)}
            prefix="$"
            valueStyle={{ fontSize: "14px", color: "#52c41a" }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="充值"
            value={formatCurrency(user.total_recharged)}
            prefix="$"
            valueStyle={{ fontSize: "14px" }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="消费"
            value={formatCurrency(user.total_spent)}
            prefix="$"
            valueStyle={{ fontSize: "14px" }}
          />
        </Col>
      </Row>

      <div style={{ fontSize: "11px", color: "#666", marginBottom: "12px" }}>
        <div>注册: {new Date(user.created_at).toLocaleDateString(getDateLocale())}</div>
        <div>
          登录:{" "}
          {user.last_login
            ? new Date(user.last_login).toLocaleDateString(getDateLocale())
            : "从未登录"}
        </div>
      </div>

      <Space style={{ width: "100%" }}>
        <Button
          size="small"
          icon={<WalletOutlined />}
          onClick={() => {
            setSelectedUser(user);
            setShowUserModal(true);
          }}
          style={{ flex: 1 }}
        >
          管理
        </Button>
        {user.status === "active" ? (
          <Popconfirm
            title="确定要暂停此用户吗？"
            onConfirm={() => handleUserStatusChange(user.id, "suspended", "管理员操作")}
          >
            <Button size="small" icon={<LockOutlined />} danger>
              暂停
            </Button>
          </Popconfirm>
        ) : (
          <Button
            size="small"
            icon={<UnlockOutlined />}
            onClick={() => handleUserStatusChange(user.id, "active")}
          >
            激活
          </Button>
        )}
      </Space>
    </Card>
  );

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
      render: (date: string) => new Date(date).toLocaleDateString(getDateLocale()),
    },
    {
      title: "最后登录",
      dataIndex: "last_login",
      key: "last_login",
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString(getDateLocale()) : "从未登录",
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: any, record: User) => (
        <Space>
          <Button
            size="small"
            icon={<WalletOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setShowUserModal(true);
            }}
          >
            管理
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

  return (
    <div style={{ padding: "16px" }}>
      <Title
        level={2}
        className="admin-title"
        style={{
          marginBottom: "20px",
          fontSize: "20px",
        }}
      >
        用户管理
      </Title>

      <Spin spinning={loading}>
        <Card
          title="用户列表"
          size="small"
          className="admin-card"
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadUsers} size="small">
              刷新
            </Button>
          }
        >
          {isMobile ? (
            <div>
              {users.map((user) => (
                <UserCard key={user.id} user={user} />
              ))}
              {users.length === 0 && !loading && (
                <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                  暂无用户数据
                </div>
              )}
            </div>
          ) : (
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              scroll={{ x: 1200 }}
              size="small"
              className="admin-table"
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showQuickJumper: false,
                simple: true,
                showTotal: (total) => `共 ${total} 条记录`,
                size: "small",
                className: "admin-pagination",
              }}
              loading={loading}
            />
          )}
        </Card>
      </Spin>

      {/* User Detail Modal */}
      <Modal
        title="用户详情"
        open={showUserModal}
        onCancel={() => setShowUserModal(false)}
        footer={null}
        width="95%"
        style={{ top: 20 }}
        className="admin-modal"
      >
        {selectedUser && (
          <div>
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexDirection: "column",
              }}
              className="admin-modal-content"
            >
              <div style={{ flex: 1 }}>
                <Card size="small" title="基本信息" className="admin-card">
                  <Descriptions column={1} className="admin-descriptions">
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
              </div>
              <div style={{ flex: 1 }}>
                <Card size="small" title="财务信息" className="admin-card">
                  <Descriptions column={1} className="admin-descriptions">
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
                      <Space
                        direction="vertical"
                        size="small"
                        style={{ width: "100%" }}
                        className="admin-balance-form"
                      >
                        <InputNumber
                          placeholder="金额"
                          min={0.01}
                          step={0.01}
                          precision={2}
                          style={{ width: "100%" }}
                          id="balance-amount"
                          size="small"
                        />
                        <Select
                          defaultValue="add"
                          style={{ width: "100%" }}
                          id="balance-type"
                          size="small"
                        >
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
                          style={{ width: "100%" }}
                        >
                          调整
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
