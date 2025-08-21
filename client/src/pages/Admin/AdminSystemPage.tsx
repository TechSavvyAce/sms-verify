import React, { useState } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Form,
  Input,
  Switch,
  InputNumber,
  Button,
  Space,
  message,
  Alert,
  Divider,
  Select,
  Upload,
  Progress,
} from "antd";
import {
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  SecurityScanOutlined,
  DatabaseOutlined,
  BellOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const AdminSystemPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [systemForm] = Form.useForm();
  const [securityForm] = Form.useForm();

  const handleSystemSave = async (values: any) => {
    try {
      setLoading(true);
      // API call to save system settings
      message.success("系统设置保存成功");
    } catch (error) {
      message.error("保存设置失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSecuritySave = async (values: any) => {
    try {
      setLoading(true);
      // API call to save security settings
      message.success("安全设置保存成功");
    } catch (error) {
      message.error("保存设置失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setLoading(true);
      // API call to create backup
      message.success("数据库备份已开始");
    } catch (error) {
      message.error("备份失败");
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setLoading(true);
      // API call to clear cache
      message.success("缓存清理成功");
    } catch (error) {
      message.error("清理缓存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        系统设置
      </Title>

      <Alert
        message="系统配置"
        description="请谨慎修改系统设置，错误的配置可能导致系统不稳定。建议在修改前创建数据库备份。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[24, 24]}>
        {/* 基本配置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <SettingOutlined />
                基本配置
              </Space>
            }
          >
            <Form
              form={systemForm}
              layout="vertical"
              onFinish={handleSystemSave}
              initialValues={{
                platform_name: "SMS验证平台",
                maintenance_mode: false,
                registration_enabled: true,
                email_verification: true,
                max_daily_activations: 50,
                default_balance: 0,
                currency: "USD",
              }}
            >
              <Form.Item
                label="平台名称"
                name="platform_name"
                rules={[{ required: true, message: "请输入平台名称" }]}
              >
                <Input placeholder="SMS验证平台" />
              </Form.Item>

              <Form.Item label="维护模式" name="maintenance_mode">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  开启后用户无法使用服务
                </Text>
              </Form.Item>

              <Form.Item label="注册开放" name="registration_enabled">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  允许新用户注册
                </Text>
              </Form.Item>

              <Form.Item label="邮件验证" name="email_verification">
                <Switch checkedChildren="必须" unCheckedChildren="可选" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  新用户必须验证邮箱
                </Text>
              </Form.Item>

              <Form.Item label="每日最大激活数" name="max_daily_activations">
                <InputNumber min={1} max={1000} style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item label="默认余额" name="default_balance">
                <InputNumber min={0} step={0.01} precision={2} style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item label="货币单位" name="currency">
                <Select>
                  <Option value="USD">美元 (USD)</Option>
                  <Option value="EUR">欧元 (EUR)</Option>
                  <Option value="CNY">人民币 (CNY)</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    保存设置
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => systemForm.resetFields()}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 安全设置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <SecurityScanOutlined />
                安全设置
              </Space>
            }
          >
            <Form
              form={securityForm}
              layout="vertical"
              onFinish={handleSecuritySave}
              initialValues={{
                max_login_attempts: 5,
                session_timeout: 120,
                password_min_length: 8,
                password_require_special: true,
                two_factor_auth: false,
                ip_whitelist_enabled: false,
                rate_limit_enabled: true,
                rate_limit_requests: 100,
                rate_limit_window: 15,
              }}
            >
              <Form.Item label="登录失败限制" name="max_login_attempts">
                <InputNumber min={1} max={10} style={{ width: "100%" }} />
                <Text type="secondary">连续失败后锁定账户</Text>
              </Form.Item>

              <Form.Item label="会话超时(分钟)" name="session_timeout">
                <InputNumber min={15} max={1440} style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item label="密码最小长度" name="password_min_length">
                <InputNumber min={6} max={20} style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item label="密码复杂度" name="password_require_special">
                <Switch checkedChildren="严格" unCheckedChildren="宽松" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  要求特殊字符和数字
                </Text>
              </Form.Item>

              <Form.Item label="强制双重认证" name="two_factor_auth">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>

              <Form.Item label="IP白名单" name="ip_whitelist_enabled">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  仅允许白名单IP访问
                </Text>
              </Form.Item>

              <Form.Item label="速率限制" name="rate_limit_enabled">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="请求限制" name="rate_limit_requests">
                    <InputNumber min={10} max={1000} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="时间窗口(分钟)" name="rate_limit_window">
                    <InputNumber min={1} max={60} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    保存设置
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => securityForm.resetFields()}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 系统维护 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                系统维护
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>数据库备份</Text>
                <br />
                <Text type="secondary">创建完整的数据库备份</Text>
                <br />
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={handleBackup}
                  loading={loading}
                  style={{ marginTop: 8 }}
                >
                  创建备份
                </Button>
              </div>

              <Divider />

              <div>
                <Text strong>缓存管理</Text>
                <br />
                <Text type="secondary">清理系统缓存以提高性能</Text>
                <br />
                <Button onClick={handleClearCache} loading={loading} style={{ marginTop: 8 }}>
                  清理缓存
                </Button>
              </div>

              <Divider />

              <div>
                <Text strong>系统状态</Text>
                <br />
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}
                  >
                    <Text>磁盘使用率</Text>
                    <Text>68%</Text>
                  </div>
                  <Progress percent={68} status="active" />
                </div>
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}
                  >
                    <Text>内存使用率</Text>
                    <Text>45%</Text>
                  </div>
                  <Progress percent={45} />
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 通知设置 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <BellOutlined />
                通知设置
              </Space>
            }
          >
            <Form layout="vertical">
              <Form.Item label="邮件通知">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text>新用户注册</Text>
                    <Switch defaultChecked />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text>系统错误</Text>
                    <Switch defaultChecked />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text>余额不足</Text>
                    <Switch defaultChecked />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text>每日报告</Text>
                    <Switch />
                  </div>
                </Space>
              </Form.Item>

              <Form.Item label="通知邮箱">
                <Input placeholder="admin@example.com" />
              </Form.Item>

              <Form.Item label="Webhook URL">
                <Input placeholder="https://your-webhook-url.com" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" icon={<SaveOutlined />}>
                  保存通知设置
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminSystemPage;
