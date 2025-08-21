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
  DatePicker,
  Popconfirm,
  Avatar,
  Descriptions,
  Divider,
  InputNumber,
} from "antd";
import {
  UserOutlined,
  ReloadOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { adminApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";

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
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Load users data
  useEffect(() => {
    loadUsers();
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

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        用户管理
      </Title>

      <Spin spinning={loading}>
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
            <div style={{ display: "flex", gap: "24px" }}>
              <div style={{ flex: 1 }}>
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
              </div>
              <div style={{ flex: 1 }}>
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
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
