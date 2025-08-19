import React from "react";
import { Card, Typography, Empty } from "antd";
import { WalletOutlined } from "@ant-design/icons";

const { Title } = Typography;

const TransactionsPage: React.FC = () => {
  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        交易记录
      </Title>
      <Card>
        <Empty
          image={
            <WalletOutlined style={{ fontSize: "64px", color: "#d9d9d9" }} />
          }
          description="暂无交易记录"
        />
      </Card>
    </div>
  );
};

export default TransactionsPage;
