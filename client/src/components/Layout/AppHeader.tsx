import React, { useState } from "react";
import { Layout, Button, Dropdown, Avatar, Space, Typography, Modal } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  WalletOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../stores/authStore";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import LanguageSwitcher from "../Common/LanguageSwitcher";

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  collapsed: boolean;
  onCollapse: () => void;
  isMobile: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ collapsed, onCollapse, isMobile }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useLocalizedNavigate();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = () => {
    logout();
    navigate("login");
    setLogoutModalVisible(false);
  };

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: t("header.personalProfile"),
      onClick: () => navigate("profile"),
    },
    {
      key: "balance",
      icon: <WalletOutlined />,
      label: t("header.balance", {
        balance: (user?.balance && typeof user.balance === "number" ? user.balance : 0).toFixed(2),
      }),
      onClick: () => navigate("balance"),
    },
    {
      type: "divider" as const,
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: t("common.settings"),
      onClick: () => navigate("profile?tab=settings"),
    },
    {
      key: "help",
      icon: <QuestionCircleOutlined />,
      label: t("header.helpCenter"),
      onClick: () => window.open("https://help.example.com", "_blank"),
    },
    {
      type: "divider" as const,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t("common.logout"),
      onClick: handleLogout,
    },
  ];

  return (
    <>
      <Header
        style={{
          padding: 0,
          background: "#fff",
          borderBottom: "1px solid #e8e8e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* 左侧：折叠按钮 */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onCollapse}
            style={{
              fontSize: "16px",
              width: 64,
              height: 64,
            }}
          />

          {/* 标题 - 移动端隐藏 */}
          {!isMobile && (
            <div style={{ marginLeft: 16 }}>
              <Text strong style={{ fontSize: "16px", color: "#1890ff" }}>
                {t("header.smsPlatform")}
              </Text>
            </div>
          )}
        </div>

        {/* 右侧：用户信息和操作 */}
        <div style={{ paddingRight: 24 }}>
          <Space size="middle">
            {/* 语言切换器 */}
            <LanguageSwitcher size="middle" type="text" showText={!isMobile} />

            {/* 用户菜单 */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
              trigger={["click"]}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: "#1890ff",
                    marginRight: isMobile ? 0 : 8,
                  }}
                />
                {!isMobile && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        lineHeight: 1.2,
                      }}
                    >
                      {user?.username || t("common.user")}
                    </Text>
                    <Text
                      style={{
                        fontSize: "12px",
                        color: "#8c8c8c",
                        lineHeight: 1.2,
                      }}
                    >
                      $
                      {(user?.balance && typeof user.balance === "number"
                        ? user.balance
                        : 0
                      ).toFixed(2)}
                    </Text>
                  </div>
                )}
              </div>
            </Dropdown>
          </Space>
        </div>
      </Header>

      {/* 退出登录确认对话框 */}
      <Modal
        title={t("header.confirmLogout")}
        open={logoutModalVisible}
        onOk={confirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
        okText={t("header.confirmLogoutButton")}
        cancelText={t("header.cancelButton")}
        centered
      >
        <p>{t("header.logoutConfirmation")}</p>
      </Modal>
    </>
  );
};

export default AppHeader;
