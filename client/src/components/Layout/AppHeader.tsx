import React, { useState } from "react";
import {
  Layout,
  Button,
  Dropdown,
  Avatar,
  Badge,
  Space,
  Typography,
  Modal,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  WalletOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate } from "react-router-dom";

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  collapsed: boolean;
  onCollapse: () => void;
  isMobile: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  collapsed,
  onCollapse,
  isMobile,
}) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = () => {
    logout();
    navigate("/login");
    setLogoutModalVisible(false);
  };

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "个人资料",
      onClick: () => navigate("/profile"),
    },
    {
      key: "balance",
      icon: <WalletOutlined />,
      label: `余额: $${(user?.balance && typeof user.balance === "number"
        ? user.balance
        : 0
      ).toFixed(2)}`,
      onClick: () => navigate("/profile?tab=balance"),
    },
    {
      type: "divider" as const,
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "设置",
      onClick: () => navigate("/profile?tab=settings"),
    },
    {
      key: "help",
      icon: <QuestionCircleOutlined />,
      label: "帮助中心",
      onClick: () => window.open("https://help.example.com", "_blank"),
    },
    {
      type: "divider" as const,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
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
                短信验证平台
              </Text>
            </div>
          )}
        </div>

        {/* 右侧：用户信息和操作 */}
        <div style={{ paddingRight: 24 }}>
          <Space size="middle">
            {/* 通知铃铛 */}
            <Badge count={0} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                size="large"
                onClick={() => {
                  // TODO: 实现通知功能
                }}
              />
            </Badge>

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
                      {user?.username || "用户"}
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
        title="确认退出"
        open={logoutModalVisible}
        onOk={confirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
        okText="确认退出"
        cancelText="取消"
        centered
      >
        <p>您确定要退出登录吗？</p>
      </Modal>
    </>
  );
};

export default AppHeader;
