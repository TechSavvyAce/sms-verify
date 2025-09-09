import React from "react";
import { Result, Button } from "antd";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";

const NotFoundPage: React.FC = () => {
  const navigate = useLocalizedNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="抱歉，您访问的页面不存在。"
      extra={
        <Button type="primary" onClick={() => navigate("dashboard")}>
          返回首页
        </Button>
      }
    />
  );
};

export default NotFoundPage;
