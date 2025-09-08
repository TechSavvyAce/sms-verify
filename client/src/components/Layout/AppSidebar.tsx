import React from "react";
import { Layout, Menu, Drawer } from "antd";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import {
  DashboardOutlined,
  MobileOutlined,
  PhoneOutlined,
  HistoryOutlined,
  WalletOutlined,
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  BarChartOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";

const { Sider } = Layout;

interface AppSidebarProps {
  collapsed: boolean;
  isMobile: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, isMobile, onCollapse }) => {
  const { t } = useTranslation();
  const navigate = useLocalizedNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // 菜单项配置
  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: t("navigation.dashboard"),
    },
    {
      key: "services",
      icon: <MobileOutlined />,
      label: t("navigation.smsServices"),
      children: [
        {
          key: "get-number",
          icon: <MessageOutlined />,
          label: t("navigation.getNumber"),
        },
        {
          key: "rent-number",
          icon: <PhoneOutlined />,
          label: t("navigation.rentNumber"),
        },
      ],
    },
    {
      key: "records",
      icon: <HistoryOutlined />,
      label: t("navigation.records"),
      children: [
        {
          key: "activations",
          icon: <MessageOutlined />,
          label: t("navigation.activations"),
        },
        {
          key: "rentals",
          icon: <ClockCircleOutlined />,
          label: t("navigation.rentals"),
        },
        {
          key: "transactions",
          icon: <WalletOutlined />,
          label: t("navigation.transactions"),
        },
      ],
    },
    {
      key: "user",
      icon: <UserOutlined />,
      label: t("navigation.userCenter"),
      children: [
        {
          key: "profile",
          icon: <UserOutlined />,
          label: t("navigation.personalCenter"),
        },
        {
          key: "balance",
          icon: <CreditCardOutlined />,
          label: t("navigation.accountRecharge"),
        },
      ],
    },
  ];

  // 如果是管理员，添加管理员菜单
  if (user?.id === 1) {
    menuItems.push({
      key: "admin",
      icon: <SettingOutlined />,
      label: t("navigation.admin"),
      children: [
        {
          key: "admin/users",
          icon: <TeamOutlined />,
          label: t("navigation.userManagement"),
        },
        {
          key: "admin/transactions",
          icon: <WalletOutlined />,
          label: t("navigation.transactionManagement"),
        },
      ],
    });
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    // 移动端点击菜单后收起侧边栏
    if (isMobile) {
      onCollapse(true);
    }
  };

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const pathname = location.pathname;
    // Remove language prefix to get the relative path
    const pathSegments = pathname.split("/").filter(Boolean);
    const hasLanguagePrefix =
      pathSegments.length > 0 && ["zh-CN", "en-US"].includes(pathSegments[0]);
    const relativePath = hasLanguagePrefix ? "/" + pathSegments.slice(1).join("/") : pathname;

    return [relativePath];
  };

  // 获取当前展开的菜单项
  const getOpenKeys = () => {
    const pathname = location.pathname;
    // Remove language prefix to get the relative path
    const pathSegments = pathname.split("/").filter(Boolean);
    const hasLanguagePrefix =
      pathSegments.length > 0 && ["zh-CN", "en-US"].includes(pathSegments[0]);
    const relativePath = hasLanguagePrefix ? "/" + pathSegments.slice(1).join("/") : pathname;

    const openKeys: string[] = [];

    if (relativePath.startsWith("/get-number") || relativePath.startsWith("/rent-number")) {
      openKeys.push("services");
    }
    if (
      relativePath.startsWith("/activations") ||
      relativePath.startsWith("/rentals") ||
      relativePath.startsWith("/transactions")
    ) {
      openKeys.push("records");
    }
    if (relativePath.startsWith("/profile") || relativePath.startsWith("/balance")) {
      openKeys.push("user");
    }
    if (relativePath.startsWith("/admin")) {
      openKeys.push("admin");
    }

    return openKeys;
  };

  const sidebarContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Logo 区域 */}
      <div
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed && !isMobile ? "center" : "flex-start",
          padding: collapsed && !isMobile ? "0" : "0 24px",
          borderBottom: "1px solid #e8e8e8",
          background: "#fff",
        }}
      >
        {collapsed && !isMobile ? (
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "#1890ff",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            S
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "#1890ff",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "16px",
                fontWeight: "bold",
                marginRight: "12px",
              }}
            >
              S
            </div>
            <span
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1890ff",
              }}
            >
              {t("sidebar.smsPlatform")}
            </span>
          </div>
        )}
      </div>

      {/* 菜单区域 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            height: "100%",
            borderRight: 0,
            paddingTop: "16px",
          }}
        />
      </div>

      {/* 底部用户信息 - 仅在展开状态显示 */}
      {!collapsed && (
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid #e8e8e8",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <UserOutlined style={{ marginRight: "8px", color: "#1890ff" }} />
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              {user?.username || t("common.user")}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
            {t("sidebar.balance", {
              balance: (user?.balance && typeof user.balance === "number"
                ? user.balance
                : 0
              ).toFixed(2),
            })}
          </div>
          <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
            {t("sidebar.status", {
              status: user?.status === "active" ? t("sidebar.normal") : t("sidebar.abnormal"),
            })}
          </div>
        </div>
      )}
    </div>
  );

  // 移动端使用 Drawer
  if (isMobile) {
    return (
      <Drawer
        title={null}
        placement="left"
        closable={false}
        onClose={() => onCollapse(true)}
        open={!collapsed}
        styles={{ body: { padding: 0 } }}
        width={280}
        style={{ zIndex: 1001 }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // 桌面端使用 Sider
  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={280}
      collapsedWidth={80}
      style={{
        overflow: "auto",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 1000,
        background: "#fff",
        borderRight: "1px solid #e8e8e8",
      }}
    >
      {sidebarContent}
    </Sider>
  );
};

export default AppSidebar;
