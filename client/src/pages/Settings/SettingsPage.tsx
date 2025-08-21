import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Row,
  Col,
  Divider,
  Modal,
  message,
  Alert,
  Table,
  Tag,
  Popconfirm,
  Tabs,
  Statistic,
  Progress,
  Select,
} from "antd";
import {
  UserOutlined,
  SecurityScanOutlined,
  KeyOutlined,
  BellOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  ApiOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import type { ColumnsType } from "antd/es/table";

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  last_used: string | null;
  created_at: string;
  status: "active" | "disabled";
}

const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [createKeyModalVisible, setCreateKeyModalVisible] = useState(false);
  const [createKeyForm] = Form.useForm();
  const [notifications, setNotifications] = useState({
    email_login: true,
    email_payment: true,
    email_rental: true,
    push_notifications: true,
    sms_notifications: false,
  });
  const [webhookConfigs, setWebhookConfigs] = useState<any>({});
  const [webhookLoading, setWebhookLoading] = useState(false);

  // 获取API密钥列表
  const fetchApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const response = await api.get("/user/api-keys");
      if (response.data?.success) {
        setApiKeys(response.data.data?.keys || []);
      }
    } catch (error: any) {
      console.error("获取API密钥失败:", error);
    } finally {
      setApiKeysLoading(false);
    }
  };

  // 创建API密钥
  const handleCreateApiKey = async (values: any) => {
    setLoading(true);
    try {
      const response = await api.post("/user/api-keys", values);
      if (response.data?.success) {
        const apiKey = response.data.data?.key;
        message.success("API密钥创建成功");
        setCreateKeyModalVisible(false);
        createKeyForm.resetFields();
        fetchApiKeys();

        // 显示新密钥（只显示一次）
        Modal.info({
          title: "API密钥创建成功",
          content: (
            <div>
              <Alert
                message="请保存此密钥，它只会显示一次！"
                type="warning"
                style={{ marginBottom: 16 }}
              />
              <Input.TextArea
                value={apiKey}
                readOnly
                autoSize={{ minRows: 3 }}
                style={{ fontFamily: "monospace" }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  message.success("已复制到剪贴板");
                }}
                style={{ marginTop: 8 }}
              >
                复制密钥
              </Button>
            </div>
          ),
          width: 500,
        });
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "创建API密钥失败"));
    } finally {
      setLoading(false);
    }
  };

  // 删除API密钥
  const handleDeleteApiKey = async (keyId: string) => {
    try {
      const response = await api.delete(`/user/api-keys/${keyId}`);
      if (response.data?.success) {
        message.success("API密钥已删除");
        fetchApiKeys();
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "删除API密钥失败"));
    }
  };

  // 更新个人资料
  const handleUpdateProfile = async (values: any) => {
    setLoading(true);
    try {
      const response = await api.put("/user/profile", values);
      if (response.data?.success) {
        message.success("个人资料更新成功");
        updateUser(response.data.data?.user);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "更新失败"));
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (values: any) => {
    setPasswordLoading(true);
    try {
      const response = await api.post("/user/change-password", values);
      if (response.data?.success) {
        message.success("密码修改成功");
        passwordForm.resetFields();
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "密码修改失败"));
    } finally {
      setPasswordLoading(false);
    }
  };

  // 更新通知设置
  const handleUpdateNotifications = async (key: string, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await api.put("/user/notifications", {
        ...notifications,
        [key]: value,
      });
      if (response.data?.success) {
        message.success("通知设置已更新");
      }
    } catch (error: any) {
      message.error("更新通知设置失败");
      // 恢复原值
      setNotifications((prev) => ({ ...prev, [key]: !value }));
    }
  };

  // 获取Webhook配置
  const fetchWebhookConfigs = async () => {
    setWebhookLoading(true);
    try {
      const types = ["rental", "payment", "activation"];
      const configs: any = {};

      for (const type of types) {
        const response = await api.get(`/webhook/config?type=${type}`);
        if (response.data?.success) {
          configs[type] = response.data.data;
        }
      }

      setWebhookConfigs(configs);
    } catch (error: any) {
      console.error("获取Webhook配置失败:", error);
      message.error(getApiErrorMessage(error.response?.data?.error, "获取Webhook配置失败"));
    } finally {
      setWebhookLoading(false);
    }
  };

  // 测试Webhook
  const handleTestWebhook = async (type: string) => {
    try {
      const config = webhookConfigs[type];
      if (!config) {
        message.error("请先获取Webhook配置");
        return;
      }

      const testPayload = {
        [type]: {
          rental: { id: "test_123", phone: "1234567890", status: "STATUS_OK" },
          payment: {
            order_id: "test_pay_123",
            status: "success",
            amount: "10.00",
          },
          activation: {
            id: "test_act_123",
            phone: "1234567890",
            status: "STATUS_OK",
            sms: "123456",
          },
        }[type],
      };

      const response = await api.post("/webhook/test", {
        url: config.webhook_url,
        payload: testPayload,
        secret: config.webhook_secret,
      });

      if (response.data?.success) {
        message.success(`${type} Webhook测试成功`);
      } else {
        message.error(`${type} Webhook测试失败`);
      }
    } catch (error: any) {
      console.error("测试Webhook失败:", error);
      message.error(getApiErrorMessage(error.response?.data?.error, "测试Webhook失败"));
    }
  };

  // 复制Webhook URL
  const handleCopyWebhookUrl = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        message.success("Webhook URL已复制到剪贴板");
      })
      .catch(() => {
        message.error("复制失败，请手动复制");
      });
  };

  // API密钥表格列
  const apiKeyColumns: ColumnsType<ApiKey> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "密钥",
      dataIndex: "key",
      key: "key",
      render: (key) => (
        <div style={{ display: "flex", alignItems: "center" }}>
          <Text code style={{ marginRight: 8 }}>
            {key.substring(0, 8)}...{key.substring(key.length - 8)}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(key);
              message.success("已复制到剪贴板");
            }}
          />
        </div>
      ),
    },
    {
      title: "权限",
      dataIndex: "permissions",
      key: "permissions",
      render: (permissions) => (
        <div>
          {permissions.map((perm: string) => (
            <Tag key={perm} color="blue" style={{ marginBottom: 4 }}>
              {perm}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={status === "active" ? "green" : "red"}>
          {status === "active" ? "活跃" : "禁用"}
        </Tag>
      ),
    },
    {
      title: "最后使用",
      dataIndex: "last_used",
      key: "last_used",
      render: (lastUsed) => lastUsed || "从未使用",
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这个API密钥吗？"
          onConfirm={() => handleDeleteApiKey(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.username,
        email: user.email,
      });
    }
  }, [user, profileForm]);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>
          <UserOutlined style={{ marginRight: "12px", color: "#722ed1" }} />
          账户设置
        </Title>
        <Paragraph type="secondary">管理您的个人资料、安全设置和偏好</Paragraph>
      </div>

      <Tabs defaultActiveKey="profile" type="card">
        {/* 个人资料 */}
        <TabPane
          tab={
            <span>
              <UserOutlined />
              个人资料
            </span>
          }
          key="profile"
        >
          <Row gutter={24}>
            <Col span={16}>
              <Card title="基本信息">
                <Form form={profileForm} layout="vertical" onFinish={handleUpdateProfile}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="username"
                        label="用户名"
                        rules={[
                          { required: true, message: "请输入用户名" },
                          { min: 3, message: "用户名至少3个字符" },
                        ]}
                      >
                        <Input prefix={<UserOutlined />} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="email"
                        label="邮箱地址"
                        rules={[
                          { required: true, message: "请输入邮箱" },
                          { type: "email", message: "请输入有效的邮箱地址" },
                        ]}
                      >
                        <Input
                          prefix={<MailOutlined />}
                          suffix={
                            (user as any)?.email_verified ? (
                              <CheckCircleOutlined style={{ color: "#52c41a" }} />
                            ) : (
                              <ExclamationCircleOutlined style={{ color: "#faad14" }} />
                            )
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {!(user as any)?.email_verified && (
                    <Alert
                      message="邮箱未验证"
                      description={
                        <div>
                          您的邮箱尚未验证，请检查您的邮箱并点击验证链接。
                          <Button type="link" size="small">
                            重新发送验证邮件
                          </Button>
                        </div>
                      }
                      type="warning"
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      style={{
                        backgroundColor: "#722ed1",
                        borderColor: "#722ed1",
                      }}
                    >
                      保存更改
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            <Col span={8}>
              <Card title="账户统计">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Statistic
                    title="账户余额"
                    value={user?.balance || 0}
                    precision={2}
                    prefix="$"
                    valueStyle={{ color: "#3f8600" }}
                  />

                  <Statistic
                    title="总消费"
                    value={user?.total_spent || 0}
                    precision={2}
                    prefix="$"
                  />

                  <Statistic
                    title="总充值"
                    value={user?.total_recharged || 0}
                    precision={2}
                    prefix="$"
                  />

                  <Divider />

                  <div>
                    <Text type="secondary">账户状态</Text>
                    <div style={{ marginTop: 8 }}>
                      <Tag color={user?.status === "active" ? "green" : "orange"}>
                        {user?.status === "active" ? "正常" : user?.status}
                      </Tag>
                    </div>
                  </div>

                  <div>
                    <Text type="secondary">注册时间</Text>
                    <div style={{ marginTop: 8 }}>
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* 安全设置 */}
        <TabPane
          tab={
            <span>
              <SecurityScanOutlined />
              安全设置
            </span>
          }
          key="security"
        >
          <Row gutter={24}>
            <Col span={12}>
              <Card title="修改密码">
                <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
                  <Form.Item
                    name="current_password"
                    label="当前密码"
                    rules={[{ required: true, message: "请输入当前密码" }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      iconRender={(visible) =>
                        visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                      }
                    />
                  </Form.Item>

                  <Form.Item
                    name="new_password"
                    label="新密码"
                    rules={[
                      { required: true, message: "请输入新密码" },
                      { min: 6, message: "密码至少6个字符" },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      iconRender={(visible) =>
                        visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                      }
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirm_password"
                    label="确认新密码"
                    dependencies={["new_password"]}
                    rules={[
                      { required: true, message: "请确认新密码" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("new_password") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("两次输入的密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      iconRender={(visible) =>
                        visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                      }
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={passwordLoading}
                      style={{
                        backgroundColor: "#722ed1",
                        borderColor: "#722ed1",
                      }}
                    >
                      更新密码
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            <Col span={12}>
              <Card title="安全信息">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <div>
                    <Text strong>最后登录时间</Text>
                    <div style={{ marginTop: 4 }}>
                      {user?.last_login ? new Date(user.last_login).toLocaleString() : "从未登录"}
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <Text strong>登录次数</Text>
                    <div style={{ marginTop: 4 }}>{user?.login_count || 0} 次</div>
                  </div>

                  <Divider />

                  <div>
                    <Text strong>账户安全评分</Text>
                    <div style={{ marginTop: 8 }}>
                      <Progress
                        percent={85}
                        strokeColor={{
                          "0%": "#108ee9",
                          "100%": "#87d068",
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        建议启用双因素认证以提高安全性
                      </Text>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* API密钥 */}
        <TabPane
          tab={
            <span>
              <KeyOutlined />
              API密钥
            </span>
          }
          key="api-keys"
        >
          <Card
            title="API密钥管理"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateKeyModalVisible(true)}
                style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
              >
                创建密钥
              </Button>
            }
          >
            <Alert
              message="API密钥安全提示"
              description="请妥善保管您的API密钥，不要在客户端代码中暴露密钥。建议定期轮换密钥以确保安全。"
              type="info"
              style={{ marginBottom: 16 }}
            />

            <Table
              columns={apiKeyColumns}
              dataSource={apiKeys}
              rowKey="id"
              loading={apiKeysLoading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        {/* 通知设置 */}
        <TabPane
          tab={
            <span>
              <BellOutlined />
              通知设置
            </span>
          }
          key="notifications"
        >
          <Card title="通知偏好">
            <Row gutter={24}>
              <Col span={12}>
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>邮件通知</Title>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <Text strong>登录通知</Text>
                        <div>
                          <Text type="secondary">当有新设备登录时发送邮件</Text>
                        </div>
                      </div>
                      <Switch
                        checked={notifications.email_login}
                        onChange={(checked) => handleUpdateNotifications("email_login", checked)}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <Text strong>支付通知</Text>
                        <div>
                          <Text type="secondary">充值和消费时发送邮件</Text>
                        </div>
                      </div>
                      <Switch
                        checked={notifications.email_payment}
                        onChange={(checked) => handleUpdateNotifications("email_payment", checked)}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <Text strong>租用通知</Text>
                        <div>
                          <Text type="secondary">租用状态变更时发送邮件</Text>
                        </div>
                      </div>
                      <Switch
                        checked={notifications.email_rental}
                        onChange={(checked) => handleUpdateNotifications("email_rental", checked)}
                      />
                    </div>
                  </Space>
                </div>
              </Col>

              <Col span={12}>
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>其他通知</Title>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <Text strong>浏览器通知</Text>
                        <div>
                          <Text type="secondary">在浏览器中显示推送通知</Text>
                        </div>
                      </div>
                      <Switch
                        checked={notifications.push_notifications}
                        onChange={(checked) =>
                          handleUpdateNotifications("push_notifications", checked)
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <Text strong>短信通知</Text>
                        <div>
                          <Text type="secondary">重要事件通过短信通知</Text>
                        </div>
                      </div>
                      <Switch
                        checked={notifications.sms_notifications}
                        onChange={(checked) =>
                          handleUpdateNotifications("sms_notifications", checked)
                        }
                      />
                    </div>
                  </Space>
                </div>
              </Col>
            </Row>
          </Card>
        </TabPane>

        {/* Webhook管理 */}
        <TabPane
          tab={
            <span>
              <ApiOutlined />
              Webhook管理
            </span>
          }
          key="webhooks"
        >
          <Card
            title="Webhook配置"
            extra={
              <Button type="primary" onClick={fetchWebhookConfigs} loading={webhookLoading}>
                刷新配置
              </Button>
            }
          >
            <Alert
              message="Webhook说明"
              description="Webhook用于接收实时通知，包括租用状态更新、支付结果通知和激活码接收。系统会自动为您的订单生成webhook URL。"
              type="info"
              style={{ marginBottom: 24 }}
            />

            <Row gutter={[24, 24]}>
              {["rental", "payment", "activation"].map((type) => {
                const config = webhookConfigs[type];
                const typeNames = {
                  rental: "租用服务",
                  payment: "支付服务",
                  activation: "激活服务",
                };

                return (
                  <Col span={24} key={type}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <LinkOutlined />
                          {typeNames[type as keyof typeof typeNames]} Webhook
                        </Space>
                      }
                      extra={
                        config && (
                          <Space>
                            <Button size="small" onClick={() => handleTestWebhook(type)}>
                              测试
                            </Button>
                            <Button
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => handleCopyWebhookUrl(config.webhook_url)}
                            >
                              复制URL
                            </Button>
                          </Space>
                        )
                      }
                    >
                      {config ? (
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <div>
                            <Text strong>Webhook URL:</Text>
                            <div style={{ marginTop: 4 }}>
                              <Input.TextArea
                                value={config.webhook_url}
                                readOnly
                                autoSize={{ minRows: 2, maxRows: 3 }}
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "12px",
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <Text strong>Secret Key:</Text>
                            <div style={{ marginTop: 4 }}>
                              <Input
                                value={config.webhook_secret}
                                readOnly
                                style={{ fontFamily: "monospace" }}
                                addonAfter={
                                  <Button
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => handleCopyWebhookUrl(config.webhook_secret)}
                                  />
                                }
                              />
                            </div>
                          </div>

                          <div>
                            <Text strong>Headers:</Text>
                            <div style={{ marginTop: 4 }}>
                              <pre
                                style={{
                                  background: "#f5f5f5",
                                  padding: "8px",
                                  borderRadius: "4px",
                                  fontSize: "12px",
                                  margin: 0,
                                }}
                              >
                                Content-Type: application/json{"\n"}
                                X-Webhook-Signature: sha256={"{signature}"}
                              </pre>
                            </div>
                          </div>

                          <Alert
                            message="使用说明"
                            description={
                              config.instructions?.zh ||
                              "请在SMS-Activate API调用时包含此webhook URL"
                            }
                            type="info"
                            showIcon
                          />
                        </Space>
                      ) : (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <Text type="secondary">点击"刷新配置"获取Webhook配置</Text>
                        </div>
                      )}
                    </Card>
                  </Col>
                );
              })}
            </Row>

            <Divider />

            <Card size="small" title="Webhook安全性">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="签名验证"
                    value="HMAC-SHA256"
                    prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                  />
                  <Text type="secondary">所有webhook请求都使用HMAC-SHA256签名验证</Text>
                </Col>
                <Col span={12}>
                  <Statistic
                    title="重试机制"
                    value="5次"
                    prefix={<ExclamationCircleOutlined style={{ color: "#faad14" }} />}
                  />
                  <Text type="secondary">失败时自动重试，采用指数退避策略</Text>
                </Col>
              </Row>
            </Card>
          </Card>
        </TabPane>
      </Tabs>

      {/* 创建API密钥模态框 */}
      <Modal
        title="创建API密钥"
        open={createKeyModalVisible}
        onCancel={() => setCreateKeyModalVisible(false)}
        onOk={() => createKeyForm.submit()}
        confirmLoading={loading}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createKeyForm} layout="vertical" onFinish={handleCreateApiKey}>
          <Form.Item
            name="name"
            label="密钥名称"
            rules={[{ required: true, message: "请输入密钥名称" }]}
          >
            <Input placeholder="例如：生产环境API" />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="权限"
            rules={[{ required: true, message: "请选择权限" }]}
          >
            <Select
              mode="multiple"
              placeholder="选择API权限"
              options={[
                { value: "read", label: "读取" },
                { value: "write", label: "写入" },
                { value: "admin", label: "管理" },
              ]}
            />
          </Form.Item>

          <Alert
            message="安全提醒"
            description="API密钥创建后只会显示一次，请务必保存。建议只授予必要的权限。"
            type="warning"
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
