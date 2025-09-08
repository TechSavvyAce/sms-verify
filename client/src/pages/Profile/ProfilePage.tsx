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
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuthStore } from "../../stores/authStore";
import { userApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import countriesData from "../../data/countries.json";
import countriesFlagData from "../../data/countries_flag.json";
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
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [profileForm] = Form.useForm();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [updateLoading, setUpdateLoading] = useState(false);

  // 根据当前语言获取本地化国家名称
  const getLocalizedCountryName = (country: any) => {
    if (currentLanguage === "zh-CN") {
      return country.name_cn || country.name;
    } else {
      return country.name || country.name_cn;
    }
  };

  // 根据国家代码获取国旗
  const getCountryFlag = (countryCode: string) => {
    const flagData = countriesFlagData.find((item) => item.code === countryCode);
    return flagData ? `https://flagcdn.com/w20/${flagData.flag.toLowerCase()}.png` : null;
  };

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
      message.error(
        getApiErrorMessage(error.response?.data?.error, t("profile.loadProfileFailed"))
      );
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
        message.success(t("profile.profileUpdateSuccess"));
        setEditMode(false);
        setAvatarFile(null);
        setAvatarPreview("");
        await loadProfileData();
      } else {
        message.error(response.message || t("profile.profileUpdateFailed"));
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      message.error(
        getApiErrorMessage(error.response?.data?.error, t("profile.profileUpdateFailed"))
      );
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
        message.error(t("profile.fileSizeExceeded"));
        return;
      }

      if (!selectedFile.type.startsWith("image/")) {
        message.error(t("profile.invalidImageFile"));
        return;
      }

      setAvatarFile(selectedFile);
      setAvatarPreview(URL.createObjectURL(selectedFile));
      message.success(t("profile.avatarSelected"));
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview("");
    message.info(t("profile.avatarRemoved"));
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
        <Empty description={t("profile.pleaseLogin")} />
      </div>
    );
  }

  return (
    <div className="profile-container" style={{ padding: "16px" }}>
      <Title
        level={2}
        className="profile-title"
        style={{
          marginBottom: "20px",
          fontSize: "20px",
        }}
      >
        {t("profile.personalCenter")}
      </Title>

      <Spin spinning={loading}>
        <div>
          {editMode ? (
            <Card
              title={t("profile.editProfile")}
              extra={
                <Space
                  direction="horizontal"
                  size="small"
                  className="button-group"
                  style={{
                    width: "100%",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    onClick={resetForm}
                    icon={<CloseOutlined />}
                    size="small"
                    className="mobile-full-width"
                    style={{ minWidth: "80px" }}
                  >
                    {t("profile.cancel")}
                  </Button>
                  <Button
                    type="primary"
                    loading={updateLoading}
                    onClick={() => profileForm.submit()}
                    icon={<SaveOutlined />}
                    size="small"
                    className="mobile-full-width"
                    style={{ minWidth: "80px" }}
                  >
                    {t("profile.save")}
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
                      label={t("profile.username")}
                      rules={[{ required: true, message: t("profile.pleaseEnterUsername") }]}
                    >
                      <Input
                        prefix={<UserOutlined />}
                        placeholder={t("profile.pleaseEnterUsername")}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item
                      name="email"
                      label={t("profile.emailAddress")}
                      rules={[
                        { required: true, message: t("profile.pleaseEnterEmail") },
                        { type: "email", message: t("profile.pleaseEnterValidEmail") },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined />}
                        placeholder={t("profile.pleaseEnterEmail")}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="phone" label={t("profile.phoneNumber")}>
                      <Input
                        prefix={<MobileOutlined />}
                        placeholder={t("profile.pleaseEnterPhone")}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="country" label={t("profile.countryRegion")}>
                      <Select
                        placeholder={t("profile.pleaseSelectCountry")}
                        showSearch
                        filterOption={(input, option) => {
                          const country = countriesData.find((c) => c.code === option?.value);
                          if (!country) return false;
                          const searchText = getLocalizedCountryName(country).toLowerCase();
                          return searchText.includes(input.toLowerCase());
                        }}
                        optionFilterProp="children"
                        size="large"
                      >
                        {countriesData
                          .filter((country) => country.available)
                          .sort((a, b) =>
                            getLocalizedCountryName(a).localeCompare(getLocalizedCountryName(b))
                          )
                          .map((country) => (
                            <Option key={country.code} value={country.code}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <img
                                  src={getCountryFlag(country.code) || country.flag}
                                  alt={country.name}
                                  style={{ width: "20px", height: "15px", objectFit: "cover" }}
                                />
                                <span>{getLocalizedCountryName(country)}</span>
                              </div>
                            </Option>
                          ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="timezone" label={t("profile.timezone")}>
                      <Select placeholder={t("profile.pleaseSelectTimezone")}>
                        <Option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</Option>
                        <Option value="America/New_York">America/New_York (UTC-5)</Option>
                        <Option value="Europe/London">Europe/London (UTC+0)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12} lg={12} xl={12}>
                    <Form.Item name="language" label={t("profile.language")}>
                      <Select placeholder={t("profile.pleaseSelectLanguage")}>
                        <Option value="zh-CN">{t("profile.simplifiedChinese")}</Option>
                        <Option value="en-US">{t("profile.english")}</Option>
                        <Option value="ja-JP">{t("profile.japanese")}</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                {/* Avatar Upload Section */}
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                    <Form.Item label={t("profile.avatarUpload")}>
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
                              <Button icon={<CameraOutlined />}>{t("profile.selectImage")}</Button>
                            </Upload>
                            {(avatarFile || avatarPreview) && (
                              <Button onClick={handleRemoveAvatar} danger size="small">
                                {t("profile.remove")}
                              </Button>
                            )}
                          </Space>
                          <div style={{ marginTop: "8px", fontSize: "12px", color: "#8c8c8c" }}>
                            {t("profile.avatarUploadHint")}
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
              title={t("profile.profileDetails")}
              extra={
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditMode(true)}
                  size="middle"
                >
                  {t("profile.editProfileButton")}
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
                      <Text strong>{t("profile.currentAvatar")}</Text>
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
                    <Descriptions.Item label={t("profile.username")}>
                      {profileData?.username || user?.username}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.emailAddress")}>
                      {profileData?.email || user?.email}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.phoneNumber")}>
                      {profileData?.phone || t("profile.notSet")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.countryRegion")}>
                      {profileData?.country
                        ? (() => {
                            const country = countriesData.find(
                              (c) => c.code === profileData.country
                            );
                            return country ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <img
                                  src={getCountryFlag(country.code) || country.flag}
                                  alt={country.name}
                                  style={{ width: "20px", height: "15px", objectFit: "cover" }}
                                />
                                <span>{getLocalizedCountryName(country)}</span>
                              </div>
                            ) : (
                              profileData.country
                            );
                          })()
                        : t("profile.notSet")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.timezone")}>
                      {profileData?.timezone || t("profile.notSet")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.language")}>
                      {profileData?.language || t("profile.notSet")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.registrationTime")}>
                      {profileData?.created_at
                        ? new Date(profileData.created_at).toLocaleString()
                        : t("profile.unknown")}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("profile.lastLogin")}>
                      {profileData?.last_login
                        ? new Date(profileData.last_login).toLocaleString()
                        : t("profile.neverLoggedIn")}
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
