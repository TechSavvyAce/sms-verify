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
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import { activationApi } from "../../services/api";

import { useWebSocket } from "../../hooks/useWebSocket";
import { Activation } from "../../types";
import { countries, serviceCategories } from "../../data/services";

const { Title, Text } = Typography;

const ActivationsPage: React.FC = () => {
  const navigate = useLocalizedNavigate();
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();

  const { isConnected, socket } = useWebSocket();

  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timers, setTimers] = useState<Record<number, number>>({});
  const [isMobile, setIsMobile] = useState(false);

  // 根据当前语言获取本地化名称
  const getLocalizedName = (item: any) => {
    if (currentLanguage === "zh-CN") {
      return item.name_cn || item.name;
    } else {
      return item.name || item.name_cn;
    }
  };

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
    } catch (error: any) {
      console.error("获取激活列表失败:", error);
      message.error(t("activations.fetchActivationsFailed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 批量检查激活状态
  const handleBulkCheck = async () => {
    const activeIds = activeActivations.map((a) => a.id);
    if (activeIds.length === 0) {
      message.info(t("activations.noActiveActivations"));
      return;
    }

    setRefreshing(true);
    try {
      // 第一步：先刷新列表获取最新状态
      message.info(t("activations.refreshingActivations"));
      await fetchActivations(false);

      // 第二步：执行批量状态检查
      message.info(t("activations.checkingStatus"));
      const response = await activationApi.bulkCheckStatus(activeIds);
      if (response.success) {
        const { updated, total } = response.data;
        if (updated > 0) {
          message.success(t("activations.updatedStatus", { count: updated }));
        } else {
          message.info(t("activations.allStatusUpToDate", { count: total }));
        }
        // 最后再次刷新列表以显示最新状态
        await fetchActivations(false);
      }
    } catch (error: any) {
      console.error("批量检查状态失败:", error);
      message.error(t("activations.bulkCheckFailed"));
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

  // 检查屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

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
    if (seconds <= 0) return t("activations.expired");

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
      message.success(t("activations.copiedToClipboard", { item: description }));
    } catch (error) {
      message.error(t("activations.copyFailed"));
    }
  };

  // 取消激活
  const handleCancel = async (activation: Activation) => {
    try {
      const response = await activationApi.cancel(activation.id);
      if (response.success) {
        message.success(t("activations.activationCancelled"));
        fetchActivations(false);
      }
    } catch (error: any) {
      console.error("取消激活失败:", error);
      message.error(t("activations.cancelFailed"));
    }
  };

  // 确认激活（收到短信后）
  const handleConfirm = async (activation: Activation) => {
    try {
      const response = await activationApi.confirm(activation.id);
      if (response.success) {
        message.success(t("activations.activationConfirmed"));
        fetchActivations(false);
      }
    } catch (error: any) {
      console.error("确认激活失败:", error);
      message.error(t("activations.confirmFailed"));
    }
  };

  // 请求重发短信
  const handleRetry = async (activation: Activation) => {
    try {
      const response = await activationApi.retry(activation.id);
      if (response.success) {
        message.success(t("activations.retryRequested"));
        fetchActivations(false);
      }
    } catch (error: any) {
      console.error("请求重发短信失败:", error);
      message.error(t("activations.retryFailed"));
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

    navigate(`get-number?${params.toString()}`);
    message.info(t("activations.reorderSettingsFilled"));
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
          text: t("activations.waitingForSms"),
          icon: <ClockCircleOutlined />,
        };
      case "1":
        return {
          color: "warning",
          text: t("activations.waitingForRetry"),
          icon: <ExclamationCircleOutlined />,
        };
      case "3":
        return {
          color: "success",
          text: t("activations.smsReceived"),
          icon: <CheckCircleOutlined />,
        };
      case "6":
        return { color: "error", text: t("activations.cancelled"), icon: <CloseOutlined /> };
      case "8":
        return {
          color: "success",
          text: t("activations.activationCompleted"),
          icon: <CheckCircleOutlined />,
        };
      default:
        return {
          color: "default",
          text: activation.status_text || t("activations.unknownStatus"),
          icon: <MessageOutlined />,
        };
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>
          <Text type="secondary">{t("activations.loadingActivations")}</Text>
        </div>
      </div>
    );
  }

  const activeActivations = activations.filter((a) => a.status !== "6" && a.status !== "8");

  return (
    <div style={{ padding: isMobile ? "16px" : "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: isMobile ? "16px" : "24px",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "12px" : "0",
        }}
      >
        <Title
          level={2}
          style={{
            margin: 0,
            fontSize: isMobile ? "18px" : "24px",
          }}
        >
          {t("activations.activationRecords")}
        </Title>
        <Space
          direction={isMobile ? "vertical" : "horizontal"}
          size={isMobile ? "small" : "middle"}
          style={{ width: isMobile ? "100%" : "auto" }}
        >
          <Badge count={activeActivations.length} style={{ backgroundColor: "#52c41a" }}>
            <Text type="secondary" style={{ fontSize: isMobile ? "12px" : "14px" }}>
              {t("activations.activeActivations")}
            </Text>
          </Badge>
          <Tooltip title={t("activations.refreshAndCheckTooltip")}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleBulkCheck}
              loading={refreshing}
              type="primary"
              size={isMobile ? "small" : "middle"}
              style={{ width: isMobile ? "100%" : "auto" }}
            >
              {refreshing ? t("activations.processing") : t("activations.refreshAndCheck")}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* WebSocket 连接状态 */}
      <div style={{ marginBottom: isMobile ? "12px" : "16px" }}>
        <Alert
          message={
            <Space size="small" direction={isMobile ? "vertical" : "horizontal"}>
              <Badge
                status={isConnected ? "success" : "error"}
                text={
                  isConnected
                    ? t("activations.realTimeConnected")
                    : t("activations.connectionDisconnected")
                }
              />
              <span
                style={{
                  fontSize: isMobile ? "12px" : "14px",
                  fontWeight: 500,
                }}
              >
                {isConnected ? t("activations.systemRunning") : t("activations.systemOffline")}
              </span>
            </Space>
          }
          description={
            <div
              style={{
                marginTop: isMobile ? "4px" : "8px",
                fontSize: isMobile ? "11px" : "13px",
              }}
            >
              {isConnected ? (
                <Text type="secondary">{t("activations.autoCheckAndPush")}</Text>
              ) : (
                <Text type="warning">{t("activations.connectionDisconnectedRefresh")}</Text>
              )}
            </div>
          }
          type={isConnected ? "success" : "warning"}
          showIcon
          style={{
            marginBottom: isMobile ? "12px" : "16px",
            borderRadius: "8px",
            border: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        />
      </div>

      {activeActivations.length === 0 ? (
        <Card size={isMobile ? "small" : "default"}>
          <Empty
            image={
              <MessageOutlined style={{ fontSize: isMobile ? "48px" : "64px", color: "#d9d9d9" }} />
            }
            description={
              <Text style={{ fontSize: isMobile ? "14px" : "16px" }}>
                {t("activations.noActiveRecords")}
              </Text>
            }
            style={{ padding: isMobile ? "30px 0" : "50px 0" }}
          >
            <Button
              type="primary"
              onClick={() => navigate("get-number")}
              size={isMobile ? "small" : "middle"}
              style={{ width: isMobile ? "100%" : "auto" }}
            >
              {t("activations.getNewNumber")}
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={isMobile ? [12, 12] : [16, 16]}>
          {activeActivations.map((activation) => {
            const country = getCountryInfo(activation.country_id);
            const statusInfo = getStatusInfo(activation);
            const serviceIcon = getServiceIcon(activation.service);
            const remainingTime = timers[activation.id] || 0;
            const timeProgress =
              remainingTime > 0 ? Math.max(0, Math.min(100, (remainingTime / (20 * 60)) * 100)) : 0;

            return (
              <Col xs={24} sm={12} md={12} lg={8} xl={8} xxl={6} key={activation.id}>
                <Card
                  size="small"
                  style={{
                    borderRadius: "12px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    border: activation.sms_code ? "2px solid #52c41a" : "1px solid #e8e8e8",
                    height: "100%",
                    transition: "all 0.3s ease",
                    background: "#ffffff",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  styles={{
                    body: {
                      padding: isMobile ? "14px" : "18px",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    },
                  }}
                >
                  {/* 头部 - 服务和国家 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      marginBottom: isMobile ? "8px" : "12px",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {/* 服务名称和状态标签 - 第一行 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {serviceIcon && (
                          <img
                            src={serviceIcon}
                            alt={activation.service_name}
                            style={{
                              width: isMobile ? "20px" : "24px",
                              height: isMobile ? "20px" : "24px",
                              marginRight: isMobile ? "6px" : "8px",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <Text
                          strong
                          style={{
                            fontSize: isMobile ? "13px" : "14px",
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {activation.service_name}
                        </Text>
                      </div>
                      <Tag
                        color={statusInfo.color}
                        icon={statusInfo.icon}
                        style={{
                          fontSize: isMobile ? "10px" : "12px",
                          marginLeft: "8px",
                        }}
                      >
                        {statusInfo.text}
                      </Tag>
                    </div>

                    {/* 国家信息 - 第二行 */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flex: 1,
                        }}
                      >
                        {country && (
                          <img
                            src={country.flag}
                            alt={country.name_cn}
                            style={{
                              width: isMobile ? "16px" : "18px",
                              height: isMobile ? "12px" : "14px",
                              marginRight: "6px",
                              borderRadius: "2px",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <Text
                          type="secondary"
                          style={{
                            fontSize: isMobile ? "11px" : "12px",
                            fontWeight: 500,
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {country ? getLocalizedName(country) : activation.country_name}
                        </Text>
                      </div>
                      {/* 空占位符，保持与第一行对齐 */}
                      <div style={{ width: "60px" }} />
                    </div>
                  </div>

                  {/* 手机号码 */}
                  {activation.phone_number && (
                    <div style={{ marginBottom: isMobile ? "8px" : "12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Space size="small">
                          <PhoneOutlined
                            style={{
                              color: "#1890ff",
                              fontSize: isMobile ? "14px" : "16px",
                            }}
                          />
                          <Text
                            strong
                            style={{
                              fontSize: isMobile ? "14px" : "16px",
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
                          onClick={() =>
                            copyToClipboard(activation.phone_number!, t("activations.phoneNumber"))
                          }
                          style={{
                            padding: isMobile ? "2px 4px" : "4px 8px",
                            fontSize: isMobile ? "10px" : "12px",
                          }}
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
                        padding: isMobile ? "6px" : "8px",
                        marginBottom: isMobile ? "8px" : "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Space size="small">
                          <MessageOutlined
                            style={{
                              color: "#52c41a",
                              fontSize: isMobile ? "14px" : "16px",
                            }}
                          />
                          <Text
                            strong
                            style={{
                              fontSize: isMobile ? "16px" : "18px",
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
                          onClick={() =>
                            copyToClipboard(activation.sms_code!, t("activations.verificationCode"))
                          }
                          style={{
                            padding: isMobile ? "2px 4px" : "4px 8px",
                            fontSize: isMobile ? "10px" : "12px",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: "#fafafa",
                        border: "1px dashed #d9d9d9",
                        borderRadius: "6px",
                        padding: isMobile ? "6px" : "8px",
                        marginBottom: isMobile ? "8px" : "12px",
                        textAlign: "center",
                      }}
                    >
                      <Text
                        type="secondary"
                        style={{
                          fontSize: isMobile ? "11px" : "12px",
                        }}
                      >
                        {t("activations.waitingForSmsCode")}
                      </Text>
                    </div>
                  )}

                  {/* 剩余时间 */}
                  <div style={{ marginBottom: isMobile ? "8px" : "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <Text
                        type="secondary"
                        style={{
                          fontSize: isMobile ? "10px" : "12px",
                        }}
                      >
                        {t("activations.remainingTime")}
                      </Text>
                      <Text
                        strong
                        style={{
                          fontSize: isMobile ? "10px" : "12px",
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
                  <div style={{ marginBottom: isMobile ? "8px" : "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        type="secondary"
                        style={{
                          fontSize: isMobile ? "10px" : "12px",
                        }}
                      >
                        {activation.is_freeprice
                          ? t("activations.actualPrice")
                          : t("activations.cost")}
                      </Text>
                      <Text
                        strong
                        style={{
                          color: "#52c41a",
                          fontSize: isMobile ? "12px" : "14px",
                        }}
                      >
                        ${activation.actual_cost || activation.cost}
                      </Text>
                    </div>
                    {activation.is_freeprice && activation.max_price && (
                      <Text
                        type="secondary"
                        style={{
                          fontSize: isMobile ? "9px" : "11px",
                        }}
                      >
                        {t("activations.maxPrice")}: ${activation.max_price}
                      </Text>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div
                    style={{
                      display: "flex",
                      gap: isMobile ? "4px" : "8px",
                      flexDirection: isMobile ? "column" : "row",
                      marginTop: "auto",
                    }}
                  >
                    <Tooltip title={t("activations.reorderWithSameSettings")}>
                      <Button
                        type="default"
                        size="small"
                        icon={<RedoOutlined />}
                        onClick={() => handleReorder(activation)}
                        style={{
                          flex: 1,
                          fontSize: isMobile ? "10px" : "12px",
                          height: isMobile ? "28px" : "32px",
                        }}
                      >
                        {t("activations.reorder")}
                      </Button>
                    </Tooltip>

                    {/* 如果状态是"等待重试"，显示重试按钮 */}
                    {activation.status === "1" && (
                      <Button
                        type="default"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => handleRetry(activation)}
                        style={{
                          flex: 1,
                          fontSize: isMobile ? "10px" : "12px",
                          height: isMobile ? "28px" : "32px",
                        }}
                      >
                        {t("activations.resendSms")}
                      </Button>
                    )}

                    {/* 如果收到短信验证码或状态是"已收到短信"，显示确认按钮 */}
                    {(activation.sms_code || activation.status === "3") && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleConfirm(activation)}
                        style={{
                          flex: 1,
                          fontSize: isMobile ? "10px" : "12px",
                          height: isMobile ? "28px" : "32px",
                        }}
                      >
                        {t("activations.confirmComplete")}
                      </Button>
                    )}

                    {/* 取消按钮 - 检查2分钟规则 */}
                    {!activation.sms_code &&
                      activation.status !== "3" &&
                      activation.status !== "6" &&
                      activation.status !== "8" &&
                      (() => {
                        const now = new Date();
                        const createdTime = new Date(activation.created_at);
                        const diffMinutes = (now.getTime() - createdTime.getTime()) / (1000 * 60);
                        const canCancelNow = diffMinutes >= 2;
                        const remainingSeconds = Math.max(
                          0,
                          Math.floor(2 * 60 - (now.getTime() - createdTime.getTime()) / 1000)
                        );

                        return canCancelNow ? (
                          <Popconfirm
                            title={t("activations.confirmCancelActivation")}
                            description={t("activations.cancelRefundDescription")}
                            onConfirm={() => handleCancel(activation)}
                            okText={t("activations.confirm")}
                            cancelText={t("activations.cancel")}
                          >
                            <Button
                              type="default"
                              size="small"
                              icon={<CloseOutlined />}
                              danger
                              style={{
                                flex: 1,
                                fontSize: isMobile ? "10px" : "12px",
                                height: isMobile ? "28px" : "32px",
                              }}
                            >
                              {t("activations.cancel")}
                            </Button>
                          </Popconfirm>
                        ) : (
                          <Button
                            type="default"
                            size="small"
                            icon={<ClockCircleOutlined />}
                            disabled
                            style={{
                              flex: 1,
                              fontSize: isMobile ? "10px" : "12px",
                              height: isMobile ? "28px" : "32px",
                            }}
                          >
                            {t("activations.cancelIn", {
                              time: formatRemainingTime(remainingSeconds),
                            })}
                          </Button>
                        );
                      })()}
                  </div>

                  {/* 额外信息 */}
                  <div
                    style={{
                      marginTop: isMobile ? "6px" : "8px",
                      paddingTop: isMobile ? "6px" : "8px",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <Text
                      type="secondary"
                      style={{
                        fontSize: isMobile ? "9px" : "11px",
                        lineHeight: isMobile ? "1.2" : "1.4",
                      }}
                    >
                      {t("activations.orderNumber")} #{activation.activation_id} •{" "}
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
