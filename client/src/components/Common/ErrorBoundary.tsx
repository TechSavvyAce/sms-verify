import React, { Component, ErrorInfo, ReactNode } from "react";
import { Result, Button, Typography, Space } from "antd";
import { ReloadOutlined, HomeOutlined, LoginOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleGoLogin = () => {
    window.location.href = "/login";
  };

  render() {
    if (this.state.hasError) {
      // 如果有自定义的 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const isAuthError =
        error?.message?.includes("认证") ||
        error?.message?.includes("token") ||
        error?.message?.includes("unauthorized");

      return (
        <Result
          status="error"
          title="页面出现错误"
          subTitle={
            <Space direction="vertical" size="small">
              <Text type="secondary">
                {isAuthError ? "认证状态异常，请重新登录" : "抱歉，页面遇到了一个错误"}
              </Text>
              {error && (
                <Text code style={{ fontSize: "12px" }}>
                  {error.message}
                </Text>
              )}
            </Space>
          }
          extra={[
            <Button
              key="reload"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.handleReload}
            >
              刷新页面
            </Button>,
            <Button key="home" icon={<HomeOutlined />} onClick={this.handleGoHome}>
              返回首页
            </Button>,
            isAuthError && (
              <Button key="login" icon={<LoginOutlined />} onClick={this.handleGoLogin}>
                重新登录
              </Button>
            ),
          ].filter(Boolean)}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
