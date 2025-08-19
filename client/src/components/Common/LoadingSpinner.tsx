import React from "react";
import { Spin, SpinProps } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

interface LoadingSpinnerProps extends SpinProps {
  tip?: string;
  overlay?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "default",
  tip = "加载中...",
  overlay = false,
  className = "",
  ...props
}) => {
  const antIcon = (
    <LoadingOutlined style={{ fontSize: size === "large" ? 24 : 16 }} spin />
  );

  const spinner = (
    <Spin
      indicator={antIcon}
      tip={tip}
      size={size}
      className={className}
      {...props}
    />
  );

  if (overlay) {
    return <div className="loading-overlay">{spinner}</div>;
  }

  return <div className="loading-container">{spinner}</div>;
};

export default LoadingSpinner;
