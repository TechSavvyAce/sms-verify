import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, Button, Card } from "antd";
import { ReloadOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props & { navigate: (path: string) => void }, State> {
  constructor(props: Props & { navigate: (path: string) => void }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.props.navigate("/dashboard");
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
          <Card>
            <Alert
              message="应用出现错误"
              description={
                <div>
                  <p>抱歉，应用遇到了一个错误。请尝试以下解决方案：</p>
                  <ul>
                    <li>刷新页面</li>
                    <li>返回首页</li>
                    <li>清除浏览器缓存</li>
                  </ul>
                  {process.env.NODE_ENV === "development" && this.state.error && (
                    <details style={{ marginTop: "16px" }}>
                      <summary>错误详情 (开发模式)</summary>
                      <pre
                        style={{
                          background: "#f5f5f5",
                          padding: "12px",
                          borderRadius: "4px",
                          overflow: "auto",
                          fontSize: "12px",
                        }}
                      >
                        {this.state.error.toString()}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              }
              type="error"
              showIcon
              style={{ marginBottom: "16px" }}
            />
            <div style={{ textAlign: "center" }}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
                style={{ marginRight: "8px" }}
              >
                刷新页面
              </Button>
              <Button icon={<HomeOutlined />} onClick={this.handleGoHome}>
                返回首页
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to provide navigation
const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  return <ErrorBoundaryClass navigate={navigate}>{children}</ErrorBoundaryClass>;
};

export default ErrorBoundary;
