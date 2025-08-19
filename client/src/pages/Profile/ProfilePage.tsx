import React from "react";
import { Card, Typography, Empty, Tabs } from "antd";
import { UserOutlined } from "@ant-design/icons";

const { Title } = Typography;

const ProfilePage: React.FC = () => {
  const items = [
    {
      key: "profile",
      label: "个人资料",
      children: (
        <Empty
          image={
            <UserOutlined style={{ fontSize: "64px", color: "#d9d9d9" }} />
          }
          description="个人资料设置"
        />
      ),
    },
    {
      key: "balance",
      label: "余额管理",
      children: <Empty description="余额管理功能" />,
    },
    {
      key: "settings",
      label: "账户设置",
      children: <Empty description="账户设置功能" />,
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        个人中心
      </Title>
      <Card>
        <Tabs items={items} />
      </Card>
    </div>
  );
};

export default ProfilePage;
