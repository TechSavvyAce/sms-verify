import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Tabs,
  Button,
  Space,
  Table,
  Modal,
  Form,
  Input,
  Alert,
  Popconfirm,
  message,
  Switch,
  Divider,
  Row,
  Col,
  Select,
} from "antd";
import {
  ApiOutlined,
  KeyOutlined,
  BellOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import api from "../../services/api";
import "./SettingsPage.css";

const { Title, Paragraph, Text } = Typography;

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
  permissions: string[];
}

interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  security_alerts: boolean;
}

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);

  const [createKeyModalVisible, setCreateKeyModalVisible] = useState(false);

  const [createKeyForm] = Form.useForm();

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    security_alerts: true,
  });

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const response = await api.get("/user/api-keys");
      console.log("API Keys response:", response);

      // Handle different response structures
      let keysData = [];
      if (response && response.data) {
        if (Array.isArray(response.data)) {
          keysData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          keysData = response.data.data;
        } else if (
          response.data.success &&
          response.data.data &&
          Array.isArray(response.data.data)
        ) {
          keysData = response.data.data;
        } else {
          console.log("Unexpected API response structure:", response.data);
          keysData = [];
        }
      }

      // Ensure we always have an array
      setApiKeys(Array.isArray(keysData) ? keysData : []);
    } catch (error) {
      console.error("Error loading API keys:", error);
      message.error("加载API密钥失败");
      setApiKeys([]);
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleCreateApiKey = async (values: any) => {
    setLoading(true);
    try {
      await api.post("/user/api-keys", values);
      message.success("API密钥创建成功");
      setCreateKeyModalVisible(false);
      createKeyForm.resetFields();
      loadApiKeys();
    } catch (error) {
      message.error("创建API密钥失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      await api.delete(`/user/api-keys/${id}`);
      message.success("API密钥删除成功");
      loadApiKeys();
    } catch (error) {
      message.error("删除API密钥失败");
    }
  };

  const handleNotificationChange = async (key: keyof NotificationSettings, value: boolean) => {
    try {
      await api.put("/notifications", { [key]: value });
      setNotificationSettings((prev) => ({ ...prev, [key]: value }));
      message.success("设置更新成功");
    } catch (error) {
      message.error("设置更新失败");
      // Revert the change on error
      setNotificationSettings((prev) => ({ ...prev, [key]: !value }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("已复制到剪贴板");
  };

  const apiKeyColumns = [
    {
      title: "密钥名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "API密钥",
      dataIndex: "key",
      key: "key",
      render: (key: string) => (
        <Space>
          <Text code style={{ fontSize: "12px" }}>
            {key.substring(0, 8)}...
          </Text>
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => copyToClipboard(key)}
          />
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: "操作",
      key: "actions",
      render: (_: any, record: ApiKey) => (
        <Popconfirm
          title="确定要删除这个API密钥吗？"
          onConfirm={() => handleDeleteApiKey(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Title level={2} className="settings-title" style={{ fontSize: "24px" }}>
          <ApiOutlined style={{ marginRight: "12px", color: "#722ed1" }} />
          开发者设置
        </Title>
        <Paragraph type="secondary">管理API密钥和系统偏好设置</Paragraph>
      </div>

      <Tabs
        defaultActiveKey="api-keys"
        className="settings-tabs-responsive"
        style={{ marginTop: "24px" }}
        items={[
          {
            key: "preferences",
            label: (
              <span>
                <SettingOutlined />
                <span className="tab-label-text">系统偏好</span>
              </span>
            ),
            children: (
              <Row gutter={[24, 16]}>
                <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                  <Card title="界面设置">
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <div>
                        <Text strong>语言设置</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            defaultValue="zh-CN"
                            style={{ width: "100%" }}
                            options={[
                              { value: "zh-CN", label: "简体中文" },
                              { value: "en-US", label: "English" },
                            ]}
                          />
                        </div>
                      </div>
                      <Divider />
                      <div>
                        <Text strong>时区设置</Text>
                        <div style={{ marginTop: 8 }}>
                          <Select
                            defaultValue="Asia/Shanghai"
                            style={{ width: "100%" }}
                            options={[
                              { value: "Asia/Shanghai", label: "中国标准时间 (UTC+8)" },
                              { value: "UTC", label: "协调世界时 (UTC)" },
                            ]}
                          />
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                  <Card title="数据管理">
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <div>
                        <Text strong>数据导出</Text>
                        <div style={{ marginTop: 8 }}>
                          <Button icon={<DatabaseOutlined />} className="mobile-full-width">
                            导出用户数据
                          </Button>
                        </div>
                      </div>
                      <Divider />
                      <div>
                        <Text strong>数据清理</Text>
                        <div style={{ marginTop: 8 }}>
                          <Button icon={<DeleteOutlined />} danger className="mobile-full-width">
                            清理过期数据
                          </Button>
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "api-keys",
            label: (
              <span>
                <KeyOutlined />
                <span className="tab-label-text">API密钥</span>
              </span>
            ),
            children: (
              <Card
                title="API密钥管理"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateKeyModalVisible(true)}
                    size="large"
                    className="mobile-full-width"
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

                {apiKeysLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <Text type="secondary">加载中...</Text>
                  </div>
                ) : Array.isArray(apiKeys) && apiKeys.length > 0 ? (
                  <Table
                    className="api-table"
                    columns={apiKeyColumns}
                    dataSource={apiKeys}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: true }}
                  />
                ) : (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <Text type="secondary">暂无API密钥</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      点击上方"创建密钥"按钮来创建您的第一个API密钥
                    </Text>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: "notifications",
            label: (
              <span>
                <BellOutlined />
                <span className="tab-label-text">通知设置</span>
              </span>
            ),
            children: (
              <Card title="通知偏好设置">
                <Row gutter={[24, 16]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <div className="notification-item">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <Text strong>邮件通知</Text>
                            <div>
                              <Text type="secondary">接收重要操作的邮件通知</Text>
                            </div>
                          </div>
                          <Switch
                            checked={notificationSettings.email_notifications}
                            onChange={(checked) =>
                              handleNotificationChange("email_notifications", checked)
                            }
                          />
                        </div>
                      </Space>
                    </div>
                  </Col>

                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <div className="notification-item">
                      <Space direction="vertical" style={{ width: "100%" }}>
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
                              <Text type="secondary">接收安全相关的短信通知</Text>
                            </div>
                          </div>
                          <Switch
                            checked={notificationSettings.sms_notifications}
                            onChange={(checked) =>
                              handleNotificationChange("sms_notifications", checked)
                            }
                          />
                        </div>
                      </Space>
                    </div>
                  </Col>

                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <div className="notification-item">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <Text strong>推送通知</Text>
                            <div>
                              <Text type="secondary">接收实时推送通知</Text>
                            </div>
                          </div>
                          <Switch
                            checked={notificationSettings.push_notifications}
                            onChange={(checked) =>
                              handleNotificationChange("push_notifications", checked)
                            }
                          />
                        </div>
                      </Space>
                    </div>
                  </Col>

                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <div className="notification-item">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <Text strong>安全警报</Text>
                            <div>
                              <Text type="secondary">接收账户安全相关的警报</Text>
                            </div>
                          </div>
                          <Switch
                            checked={notificationSettings.security_alerts}
                            onChange={(checked) =>
                              handleNotificationChange("security_alerts", checked)
                            }
                          />
                        </div>
                      </Space>
                    </div>
                  </Col>
                </Row>
              </Card>
            ),
          },
        ]}
      />

      {/* 创建API密钥模态框 */}
      <Modal
        className="create-key-modal"
        title="创建API密钥"
        open={createKeyModalVisible}
        onCancel={() => setCreateKeyModalVisible(false)}
        onOk={() => createKeyForm.submit()}
        confirmLoading={loading}
        okText="创建"
        cancelText="取消"
        width="600px"
      >
        <Form form={createKeyForm} layout="vertical" onFinish={handleCreateApiKey}>
          <Form.Item
            name="name"
            label="密钥名称"
            rules={[
              { required: true, message: "请输入密钥名称" },
              { min: 2, message: "密钥名称至少2个字符" },
            ]}
          >
            <Input placeholder="请输入密钥名称" />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="权限范围"
            rules={[{ required: true, message: "请选择权限范围" }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择权限范围"
              options={[
                { value: "read", label: "读取权限" },
                { value: "write", label: "写入权限" },
                { value: "delete", label: "删除权限" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
