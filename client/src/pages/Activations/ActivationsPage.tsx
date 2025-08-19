import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Typography,
  Empty,
  Row,
  Col,
  Button,
  Tag,
  Space,
  message,
  Tooltip,
  Spin,
  Alert,
  Progress,
  Badge,
  Popconfirm,
} from "antd";
import {
  MessageOutlined,
  ReloadOutlined,
  CopyOutlined,
  CloseOutlined,
  RedoOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { activationApi } from "../../services/api";

import { useWebSocket } from "../../hooks/useWebSocket";
import { Activation } from "../../types";
import { countries, serviceCategories } from "../../data/services";

const { Title, Text } = Typography;

const ActivationsPage: React.FC = () => {
  const navigate = useNavigate();

  const { isConnected, socket } = useWebSocket();

  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timers, setTimers] = useState<Record<number, number>>({});

  // 获取激活列表
  const fetchActivations = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const response = await activationApi.getList({
        status: "0,1,3,8", // 获取所有相关状态的激活 (使用逗号分隔的字符串)
        limit: 50,
      });

      if (response.success && response.data?.data) {
        setActivations(response.data.data);
        console.log(response.data.data);
        // 初始化倒计时器
        const newTimers: Record<number, number> = {};
        response.data.data.forEach((activation) => {
          if (activation.status !== "6" && activation.status !== "8") {
            const expiresAt = new Date(activation.expires_at).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            newTimers[activation.id] = remaining;
          }
        });
        setTimers(newTimers);
      }
    } catch (error) {
      console.error("获取激活列表失败:", error);
      message.error("获取激活列表失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 批量检查激活状态
  const handleBulkCheck = async () => {
    const activeIds = activeActivations.map((a) => a.id);
    if (activeIds.length === 0) {
      message.info("没有活跃的激活记录需要检查");
      return;
    }

    setRefreshing(true);
    try {
      // 第一步：先刷新列表获取最新状态
      message.info("正在刷新激活列表...");
      await fetchActivations(false);

      // 第二步：执行批量状态检查
      message.info("正在检查激活状态...");
      const response = await activationApi.bulkCheckStatus(activeIds);
      if (response.success) {
        const { updated, total } = response.data;
        if (updated > 0) {
          message.success(`已更新 ${updated} 个激活状态`);
        } else {
          message.info(`已检查 ${total} 个激活，状态都是最新的`);
        }
        // 最后再次刷新列表以显示最新状态
        await fetchActivations(false);
      }
    } catch (error) {
      console.error("批量检查状态失败:", error);
      message.error("批量检查状态失败");
      // 即使检查失败，也尝试刷新列表
      await fetchActivations(false);
    } finally {
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchActivations();
  }, [fetchActivations]);

  // WebSocket 实时更新
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleActivationUpdated = (data: any) => {
      console.log("收到激活更新:", data);
      setActivations((prev) =>
        prev.map((activation) =>
          activation.id === data.id
            ? {
                ...activation,
                status: data.status,
                sms_code: data.sms_code,
                status_text: data.status_text,
              }
            : activation
        )
      );
    };

    const handleActivationCreated = (data: any) => {
      console.log("收到新激活:", data);
      fetchActivations(false); // 重新获取列表
    };

    socket.on("activation_updated", handleActivationUpdated);
    socket.on("activation_created", handleActivationCreated);

    return () => {
      socket.off("activation_updated", handleActivationUpdated);
      socket.off("activation_created", handleActivationCreated);
    };
  }, [socket, isConnected, fetchActivations]);

  // 倒计时更新
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        const updated = { ...prev };
        let hasChanges = false;

        Object.keys(updated).forEach((key) => {
          const id = parseInt(key);
          if (updated[id] > 0) {
            updated[id] -= 1;
            hasChanges = true;
          } else if (updated[id] === 0) {
            // 时间到了，重新获取状态
            fetchActivations(false);
          }
        });

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchActivations]);

  // 格式化剩余时间
  const formatRemainingTime = (seconds: number): string => {
    if (seconds <= 0) return "已过期";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes
        .toString()
        .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`${description}已复制到剪贴板`);
    } catch (error) {
      message.error("复制失败");
    }
  };

  // 取消激活
  const handleCancel = async (activation: Activation) => {
    try {
      const response = await activationApi.cancel(activation.id);
      if (response.success) {
        message.success("激活已取消");
        fetchActivations(false);
      }
    } catch (error) {
      console.error("取消激活失败:", error);
      message.error("取消激活失败");
    }
  };

  // 确认激活（收到短信后）
  const handleConfirm = async (activation: Activation) => {
    try {
      const response = await activationApi.confirm(activation.id);
      if (response.success) {
        message.success("激活已确认完成！");
        fetchActivations(false);
      }
    } catch (error) {
      console.error("确认激活失败:", error);
      message.error("确认激活失败");
    }
  };

  // 请求重发短信
  const handleRetry = async (activation: Activation) => {
    try {
      const response = await activationApi.retry(activation.id);
      if (response.success) {
        message.success("已请求重发短信，请稍候...");
        fetchActivations(false);
      }
    } catch (error) {
      console.error("请求重发短信失败:", error);
      message.error("请求重发短信失败");
    }
  };

  // 重新订购（相同设置）
  const handleReorder = (activation: Activation) => {
    // 构建重新订购的 URL 参数
    const params = new URLSearchParams({
      service: activation.service,
      country: activation.country_id.toString(),
      operator: activation.operator || "any",
    });

    navigate(`/get-number?${params.toString()}`);
    message.info("已为您填入相同设置，请确认订单");
  };

  // 获取服务图标
  const getServiceIcon = (serviceCode: string) => {
    for (const category of serviceCategories) {
      const service = category.services.find((s) => s.code === serviceCode);
      if (service) {
        return `https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${serviceCode}0.webp`;
      }
    }
    return null;
  };

  // 获取国家信息
  const getCountryInfo = (countryId: number) => {
    return countries.find((c) => c.id === countryId);
  };

  // 获取状态信息
  const getStatusInfo = (activation: Activation) => {
    switch (activation.status) {
      case "0":
        return {
          color: "processing",
          text: "等待短信",
          icon: <ClockCircleOutlined />,
        };
      case "1":
        return {
          color: "warning",
          text: "等待重试",
          icon: <ExclamationCircleOutlined />,
        };
      case "3":
        return {
          color: "success",
          text: "已收到短信",
          icon: <CheckCircleOutlined />,
        };
      case "6":
        return { color: "error", text: "已取消", icon: <CloseOutlined /> };
      case "8":
        return {
          color: "success",
          text: "激活完成",
          icon: <CheckCircleOutlined />,
        };
      default:
        return {
          color: "default",
          text: activation.status_text || "未知状态",
          icon: <MessageOutlined />,
        };
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>
          <Text type="secondary">正在加载激活记录...</Text>
        </div>
      </div>
    );
  }

  const activeActivations = activations.filter((a) => a.status !== "6" && a.status !== "8");

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          激活记录
        </Title>
        <Space>
          <Badge count={activeActivations.length} style={{ backgroundColor: "#52c41a" }}>
            <Text type="secondary">活跃激活</Text>
          </Badge>
          <Tooltip title="先刷新列表，然后检查所有活跃激活的最新状态">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleBulkCheck}
              loading={refreshing}
              type="primary"
            >
              {refreshing ? "处理中..." : "刷新并检查"}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* WebSocket 连接状态 */}
      <div style={{ marginBottom: "16px" }}>
        <Alert
          message={
            <Space size="small">
              <Badge
                status={isConnected ? "success" : "error"}
                text={isConnected ? "实时连接" : "连接断开"}
              />
              <span style={{ fontSize: "14px", fontWeight: 500 }}>
                {isConnected ? "系统运行中" : "系统离线"}
              </span>
            </Space>
          }
          description={
            <div style={{ marginTop: "8px", fontSize: "13px" }}>
              {isConnected ? (
                <Text type="secondary">自动检查激活状态 • 实时推送短信验证码</Text>
              ) : (
                <Text type="warning">连接已断开，请刷新页面重新连接</Text>
              )}
            </div>
          }
          type={isConnected ? "success" : "warning"}
          showIcon
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            border: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        />
      </div>

      {activeActivations.length === 0 ? (
        <Card>
          <Empty
            image={<MessageOutlined style={{ fontSize: "64px", color: "#d9d9d9" }} />}
            description="暂无活跃的激活记录"
            style={{ padding: "50px 0" }}
          >
            <Button type="primary" onClick={() => navigate("/get-number")}>
              获取新号码
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {activeActivations.map((activation) => {
            const country = getCountryInfo(activation.country_id);
            const statusInfo = getStatusInfo(activation);
            const serviceIcon = getServiceIcon(activation.service);
            const remainingTime = timers[activation.id] || 0;
            const timeProgress =
              remainingTime > 0 ? Math.max(0, Math.min(100, (remainingTime / (20 * 60)) * 100)) : 0;

            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={activation.id}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    border: activation.sms_code ? "2px solid #52c41a" : "1px solid #d9d9d9",
                  }}
                  bodyStyle={{ padding: "16px" }}
                >
                  {/* 头部 - 服务和国家 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      {serviceIcon && (
                        <img
                          src={serviceIcon}
                          alt={activation.service_name}
                          style={{
                            width: "24px",
                            height: "24px",
                            marginRight: "8px",
                            borderRadius: "4px",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div>
                        <Text strong style={{ fontSize: "14px" }}>
                          {activation.service_name}
                        </Text>
                        <br />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: "2px",
                          }}
                        >
                          {country && (
                            <img
                              src={country.flag}
                              alt={country.name_cn}
                              style={{
                                width: "16px",
                                height: "12px",
                                marginRight: "4px",
                                borderRadius: "2px",
                              }}
                            />
                          )}
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            {activation.country_name}
                          </Text>
                        </div>
                      </div>
                    </div>

                    <Tag color={statusInfo.color} icon={statusInfo.icon}>
                      {statusInfo.text}
                    </Tag>
                  </div>

                  {/* 手机号码 */}
                  {activation.phone_number && (
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Space>
                          <PhoneOutlined style={{ color: "#1890ff" }} />
                          <Text
                            strong
                            style={{
                              fontSize: "16px",
                              fontFamily: "monospace",
                            }}
                          >
                            {activation.phone_number}
                          </Text>
                        </Space>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(activation.phone_number!, "手机号码")}
                        />
                      </div>
                    </div>
                  )}

                  {/* 短信验证码 */}
                  {activation.sms_code ? (
                    <div
                      style={{
                        backgroundColor: "#f6ffed",
                        border: "1px solid #b7eb8f",
                        borderRadius: "6px",
                        padding: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Space>
                          <MessageOutlined style={{ color: "#52c41a" }} />
                          <Text
                            strong
                            style={{
                              fontSize: "18px",
                              fontFamily: "monospace",
                              color: "#52c41a",
                            }}
                          >
                            {activation.sms_code}
                          </Text>
                        </Space>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(activation.sms_code!, "验证码")}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: "#fafafa",
                        border: "1px dashed #d9d9d9",
                        borderRadius: "6px",
                        padding: "8px",
                        marginBottom: "12px",
                        textAlign: "center",
                      }}
                    >
                      <Text type="secondary">等待短信验证码...</Text>
                    </div>
                  )}

                  {/* 剩余时间 */}
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        剩余时间
                      </Text>
                      <Text
                        strong
                        style={{
                          fontSize: "12px",
                          color: remainingTime < 300 ? "#ff4d4f" : "#1890ff",
                        }}
                      >
                        {formatRemainingTime(remainingTime)}
                      </Text>
                    </div>
                    <Progress
                      percent={timeProgress}
                      showInfo={false}
                      size="small"
                      strokeColor={remainingTime < 300 ? "#ff4d4f" : "#1890ff"}
                    />
                  </div>

                  {/* 价格信息 */}
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {activation.is_freeprice ? "实际价格" : "费用"}
                      </Text>
                      <Text strong style={{ color: "#52c41a" }}>
                        ${activation.actual_cost || activation.cost}
                      </Text>
                    </div>
                    {activation.is_freeprice && activation.max_price && (
                      <Text type="secondary" style={{ fontSize: "11px" }}>
                        最大价格: ${activation.max_price}
                      </Text>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Tooltip title="使用相同设置重新订购">
                      <Button
                        type="default"
                        size="small"
                        icon={<RedoOutlined />}
                        onClick={() => handleReorder(activation)}
                        style={{ flex: 1 }}
                      >
                        重新订购
                      </Button>
                    </Tooltip>

                    {/* 如果状态是"等待重试"，显示重试按钮 */}
                    {activation.status === "1" && (
                      <Button
                        type="default"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => handleRetry(activation)}
                        style={{ flex: 1 }}
                      >
                        重发短信
                      </Button>
                    )}

                    {/* 如果收到短信验证码或状态是"已收到短信"，显示确认按钮 */}
                    {(activation.sms_code || activation.status === "3") && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleConfirm(activation)}
                        style={{ flex: 1 }}
                      >
                        确认完成
                      </Button>
                    )}

                    {/* 只有在可以取消且未收到短信时才显示取消按钮 */}
                    {activation.can_cancel &&
                      !activation.sms_code &&
                      activation.status !== "3" &&
                      activation.status !== "6" &&
                      activation.status !== "8" && (
                        <Popconfirm
                          title="确认取消激活?"
                          description="取消后将返还部分费用到您的账户"
                          onConfirm={() => handleCancel(activation)}
                          okText="确认"
                          cancelText="取消"
                        >
                          <Button type="default" size="small" icon={<CloseOutlined />} danger>
                            取消
                          </Button>
                        </Popconfirm>
                      )}
                  </div>

                  {/* 额外信息 */}
                  <div
                    style={{
                      marginTop: "8px",
                      paddingTop: "8px",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: "11px" }}>
                      订单 #{activation.activation_id} •{" "}
                      {new Date(activation.created_at).toLocaleString()}
                    </Text>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default ActivationsPage;
