import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Avatar,
  Row,
  Col,
  Button,
  Space,
  Form,
  Input,
  Select,
  Upload,
  Descriptions,
  message,
  Spin,
  Empty,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CameraOutlined,
  MailOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { userApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import "./ProfilePage.css";

const { Title, Text } = Typography;
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
  password_hash?: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [profileForm] = Form.useForm();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [updateLoading, setUpdateLoading] = useState(false);

  // Load profile data
  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const response = await userApi.getProfile();
      if (response.success && response.data) {
        const profile = response.data as unknown as UserProfile;
        setProfileData(profile);
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "加载个人资料失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (values: any) => {
    try {
      setUpdateLoading(true);
      const formData = new FormData();

      Object.keys(values).forEach((key) => {
        if (values[key] !== undefined && values[key] !== null && values[key] !== "") {
          formData.append(key, values[key]);
        }
      });

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
      } else {
        message.error(response.message || "更新个人资料失败");
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      message.error(getApiErrorMessage(error.response?.data?.error, "更新个人资料失败"));
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleAvatarChange = (info: any) => {
    const file = info.file;

    if (file.status === "uploading") {
      return;
    }

    if (file.status === "done" || file.originFileObj) {
      const selectedFile = file.originFileObj || file;

      if (selectedFile.size > 2 * 1024 * 1024) {
        message.error("文件大小不能超过 2MB");
        return;
      }

      if (!selectedFile.type.startsWith("image/")) {
        message.error("请选择有效的图片文件");
        return;
      }

      setAvatarFile(selectedFile);
      setAvatarPreview(URL.createObjectURL(selectedFile));
      message.success("头像已选择，请点击保存按钮应用更改");
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview("");
    message.info("头像已移除，请点击保存按钮应用更改");
  };

  const resetForm = () => {
    setEditMode(false);
    setAvatarFile(null);
    setAvatarPreview("");
    if (profileData) {
      profileForm.setFieldsValue({
        username: profileData.username,
        email: profileData.email,
        phone: profileData.phone || "",
        country: profileData.country || "",
        timezone: profileData.timezone || "",
        language: profileData.language || "",
      });
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description="请先登录" />
      </div>
    );
  }

  return (
    <div className="profile-container" style={{ padding: "24px" }}>
      <Title
        level={2}
        className="profile-title"
        style={{
          marginBottom: "24px",
          fontSize: "24px",
        }}
      >
        个人中心
      </Title>

      <Spin spinning={loading}>
        <div>
          {editMode ? (
            <Card
              title="编辑个人资料"
              extra={
                <Space direction="horizontal" size="small" className="button-group">
                  <Button
                    onClick={resetForm}
                    icon={<CloseOutlined />}
                    size="middle"
                    block={false}
                    className="mobile-full-width"
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    loading={updateLoading}
                    onClick={() => profileForm.submit()}
                    icon={<SaveOutlined />}
                    size="middle"
                    block={false}
                    className="mobile-full-width"
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
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item
                      name="username"
                      label="用户名"
                      rules={[{ required: true, message: "请输入用户名" }]}
                    >
                      <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
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

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="phone" label="手机号码">
                      <Input prefix={<MobileOutlined />} placeholder="请输入手机号码" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
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

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="timezone" label="时区">
                      <Select placeholder="请选择时区">
                        <Option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</Option>
                        <Option value="America/New_York">America/New_York (UTC-5)</Option>
                        <Option value="Europe/London">Europe/London (UTC+0)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="language" label="语言">
                      <Select placeholder="请选择语言">
                        <Option value="zh-CN">简体中文</Option>
                        <Option value="en-US">English</Option>
                        <Option value="ja-JP">日本語</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                {/* Avatar Upload Section */}
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                    <Form.Item label="头像上传">
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <Avatar
                          size={80}
                          src={avatarPreview || profileData?.avatar}
                          icon={<UserOutlined />}
                        />
                        <div style={{ flex: 1 }}>
                          <Space direction="horizontal" size="small">
                            <Upload
                              name="avatar"
                              showUploadList={false}
                              beforeUpload={() => false}
                              onChange={handleAvatarChange}
                              accept="image/*"
                            >
                              <Button icon={<CameraOutlined />}>选择图片</Button>
                            </Upload>
                            {(avatarFile || avatarPreview) && (
                              <Button onClick={handleRemoveAvatar} danger size="small">
                                移除
                              </Button>
                            )}
                          </Space>
                          <div style={{ marginTop: "8px", fontSize: "12px", color: "#8c8c8c" }}>
                            支持 JPG、PNG 格式，文件大小不超过 2MB
                          </div>
                        </div>
                      </div>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          ) : (
            <Card
              title="个人资料详情"
              extra={
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditMode(true)}
                  size="middle"
                >
                  编辑资料
                </Button>
              }
            >
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={24} md={8} lg={8} xl={8}>
                  <div style={{ textAlign: "center" }}>
                    <Avatar
                      size={120}
                      src={profileData?.avatar}
                      icon={<UserOutlined />}
                      style={{ marginBottom: "16px" }}
                    />
                    <div>
                      <Text strong>当前头像</Text>
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={24} md={16} lg={16} xl={16}>
                  <Descriptions
                    bordered
                    column={{ xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }}
                    size="default"
                    className="descriptions-responsive"
                  >
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
                </Col>
              </Row>
            </Card>
          )}
        </div>
      </Spin>
    </div>
  );
};

export default ProfilePage;
