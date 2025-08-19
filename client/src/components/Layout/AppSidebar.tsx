import React from "react";
import { Layout, Menu, Drawer } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
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
} from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";

const { Sider } = Layout;

interface AppSidebarProps {
  collapsed: boolean;
  isMobile: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed, isMobile, onCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // 菜单项配置
  const menuItems = [
    {
      key: "/dashboard",
      icon: <DashboardOutlined />,
      label: "仪表板",
    },
    {
      key: "services",
      icon: <MobileOutlined />,
      label: "短信服务",
      children: [
        {
          key: "/get-number",
          icon: <MessageOutlined />,
          label: "获取号码",
        },
        {
          key: "/rent-number",
          icon: <PhoneOutlined />,
          label: "租用号码",
        },
      ],
    },
    {
      key: "records",
      icon: <HistoryOutlined />,
      label: "记录管理",
      children: [
        {
          key: "/activations",
          icon: <MessageOutlined />,
          label: "激活记录",
        },
        {
          key: "/rentals",
          icon: <ClockCircleOutlined />,
          label: "租用记录",
        },
        {
          key: "/transactions",
          icon: <WalletOutlined />,
          label: "交易记录",
        },
      ],
    },
    {
      key: "user",
      icon: <UserOutlined />,
      label: "用户中心",
      children: [
        {
          key: "/profile",
          icon: <UserOutlined />,
          label: "个人中心",
        },
        {
          key: "/settings",
          icon: <SettingOutlined />,
          label: "账户设置",
        },
      ],
    },
  ];

  // 如果是管理员，添加管理员菜单
  if (user?.id === 1) {
    menuItems.push({
      key: "admin",
      icon: <SettingOutlined />,
      label: "系统管理",
      children: [
        {
          key: "/admin/dashboard",
          icon: <BarChartOutlined />,
          label: "管理面板",
        },
        {
          key: "/admin/users",
          icon: <TeamOutlined />,
          label: "用户管理",
        },
        {
          key: "/admin/system",
          icon: <SettingOutlined />,
          label: "系统设置",
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
    return [pathname];
  };

  // 获取当前展开的菜单项
  const getOpenKeys = () => {
    const pathname = location.pathname;
    const openKeys: string[] = [];

    if (pathname.startsWith("/get-number") || pathname.startsWith("/rent-number")) {
      openKeys.push("services");
    }
    if (
      pathname.startsWith("/activations") ||
      pathname.startsWith("/rentals") ||
      pathname.startsWith("/transactions")
    ) {
      openKeys.push("records");
    }
    if (pathname.startsWith("/admin")) {
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
              SMS平台
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
            <span style={{ fontSize: "14px", fontWeight: "500" }}>{user?.username || "用户"}</span>
          </div>
          <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
            余额: $
            {(user?.balance && typeof user.balance === "number" ? user.balance : 0).toFixed(2)}
          </div>
          <div style={{ fontSize: "12px", color: "#8c8c8c" }}>
            状态: {user?.status === "active" ? "正常" : "异常"}
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
        bodyStyle={{ padding: 0 }}
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
