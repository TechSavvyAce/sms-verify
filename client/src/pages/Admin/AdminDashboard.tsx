import React from "react";
import { Card, Typography, Empty, Alert } from "antd";
import { SettingOutlined } from "@ant-design/icons";

const { Title } = Typography;

const AdminDashboard: React.FC = () => {
  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        管理面板
      </Title>
      <Alert
        message="管理员功能"
        description="管理员功能正在开发中，敬请期待。"
        type="info"
        showIcon
        style={{ marginBottom: "24px" }}
      />
      <Card>
        <Empty
          image={
            <SettingOutlined style={{ fontSize: "64px", color: "#d9d9d9" }} />
          }
          description="管理功能开发中"
        />
      </Card>
    </div>
  );
};

export default AdminDashboard;
