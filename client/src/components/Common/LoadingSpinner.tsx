import React from "react";
import { Spin, Typography, Space } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface LoadingSpinnerProps {
  size?: "small" | "default" | "large";
  text?: string;
  fullScreen?: boolean;
  tip?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "large",
  text = "加载中...",
  fullScreen = false,
  tip,
}) => {
  const antIcon = <LoadingOutlined style={{ fontSize: size === "large" ? 32 : 24 }} spin />;

  if (fullScreen) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255, 255, 255, 0.9)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <Spin indicator={antIcon} size={size} />
        {text && <Text style={{ marginTop: 16, fontSize: 16, color: "#666" }}>{text}</Text>}
        {tip && <Text style={{ marginTop: 8, fontSize: 14, color: "#999" }}>{tip}</Text>}
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <Space direction="vertical" size="middle">
        <Spin indicator={antIcon} size={size} />
        {text && <Text style={{ fontSize: 16, color: "#666" }}>{text}</Text>}
        {tip && <Text style={{ fontSize: 14, color: "#999" }}>{tip}</Text>}
      </Space>
    </div>
  );
};

export default LoadingSpinner;
