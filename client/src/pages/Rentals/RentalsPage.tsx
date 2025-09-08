import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Tooltip,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  Progress,
  List,
} from "antd";
import {
  PhoneOutlined,
  ClockCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuthStore } from "../../stores/authStore";
import { rentalApi } from "../../services/api";
import countriesData from "../../data/countries.json";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import type { ColumnsType } from "antd/es/table";
import moment from "moment";
import { Rental } from "../../types";

const { Title, Text, Paragraph } = Typography;

interface RentalMessage {
  phoneFrom: string;
  text: string;
  service: string;
  date: string;
}

const RentalsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { user } = useAuthStore();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [extendModalVisible, setExtendModalVisible] = useState(false);
  const [messages, setMessages] = useState<RentalMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [extendHours, setExtendHours] = useState(4);
  const [extendPrice, setExtendPrice] = useState(0);
  const [extendLoading, setExtendLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    status: null as string | null,
    service: null as string | null,
    country: null as number | null,
    dateRange: null as [moment.Moment, moment.Moment] | null,
  });

  // 根据当前语言获取本地化名称
  const getLocalizedName = (item: any) => {
    if (currentLanguage === "zh-CN") {
      return item.name_cn || item.name;
    } else {
      return item.name || item.name_cn;
    }
  };

  // 获取租用列表
  const fetchRentals = useCallback(
    async (page = 1, pageSize = 10) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageSize.toString(),
        });

        if (filters.status) params.append("status", filters.status);
        if (filters.service) params.append("service", filters.service);
        if (filters.country) params.append("country", filters.country.toString());

        const response = await rentalApi.getList({
          page: parseInt(page.toString()),
          limit: parseInt(pageSize.toString()),
          status: filters.status || undefined,
          service: filters.service || undefined,
          country: filters.country || undefined,
        });

        if (response.success && response.data) {
          setRentals(response.data.data || []);
          setPagination({
            current: response.data.pagination.page,
            pageSize: response.data.pagination.limit,
            total: response.data.pagination.total,
          });
        }
      } catch (error: any) {
        console.error("获取租用列表失败:", error);
        message.error(
          getApiErrorMessage(error.response?.data?.error, t("rentals.fetchRentalsFailed"))
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  // 获取租用状态和消息
  const fetchRentalMessages = async (rental: Rental) => {
    setMessagesLoading(true);
    try {
      const response = await rentalApi.getSMS(rental.id);

      if (response.data?.success) {
        const messagesData = response.data.messages.values || {};
        const messagesList = Object.values(messagesData) as RentalMessage[];
        setMessages(messagesList);
      }
    } catch (error: any) {
      console.error("获取消息失败:", error);
      message.error(
        getApiErrorMessage(error.response?.data?.error, t("rentals.fetchMessagesFailed"))
      );
    } finally {
      setMessagesLoading(false);
    }
  };

  // 获取延长信息
  const fetchExtendInfo = async (rental: Rental, hours: number) => {
    try {
      const response = await rentalApi.getExtendInfo(rental.id, hours);

      if (response.data?.success) {
        setExtendPrice(response.data.markup_price);
      }
    } catch (error: any) {
      console.error("获取延长信息失败:", error);
    }
  };

  // 延长租用
  const handleExtendRental = async () => {
    if (!selectedRental) return;

    setExtendLoading(true);
    try {
      const response = await rentalApi.extend(selectedRental.id, extendHours);

      if (response.data?.success) {
        message.success(t("rentals.rentalExtendedSuccess"));
        setExtendModalVisible(false);
        fetchRentals(pagination.current, pagination.pageSize);
      } else {
        throw new Error(getApiErrorMessage(response.data?.error, t("rentals.extendFailed")));
      }
    } catch (error: any) {
      console.error("延长租用失败:", error);
      message.error(
        getApiErrorMessage(error.response?.data?.error, t("rentals.extendRentalFailed"))
      );
    } finally {
      setExtendLoading(false);
    }
  };

  // 取消租用
  const handleCancelRental = async (rental: Rental) => {
    Modal.confirm({
      title: t("rentals.confirmCancelRental"),
      content: (
        <div>
          <p>{t("rentals.confirmCancelRentalQuestion")}</p>
          <p>
            {t("rentals.phoneNumber")}: {rental.phone_number}
          </p>
          <p style={{ color: "#ff4d4f" }}>{t("rentals.cancelRentalWarning")}</p>
        </div>
      ),
      onOk: async () => {
        try {
          const response = await rentalApi.cancel(rental.id);

          if (response.data?.success) {
            message.success(t("rentals.rentalCancelled"));
            fetchRentals(pagination.current, pagination.pageSize);
          } else {
            throw new Error(getApiErrorMessage(response.data?.error, t("rentals.cancelFailed")));
          }
        } catch (error: any) {
          console.error("取消租用失败:", error);
          message.error(
            getApiErrorMessage(error.response?.data?.error, t("rentals.cancelRentalFailed"))
          );
        }
      },
    });
  };

  // 完成租用
  const handleFinishRental = async (rental: Rental) => {
    Modal.confirm({
      title: t("rentals.confirmFinishRental"),
      content: (
        <div>
          <p>{t("rentals.confirmFinishRentalQuestion")}</p>
          <p>
            {t("rentals.phoneNumber")}: {rental.phone_number}
          </p>
          <p>{t("rentals.finishRentalWarning")}</p>
        </div>
      ),
      onOk: async () => {
        try {
          const response = await rentalApi.finish(rental.id);

          if (response.data?.success) {
            message.success(t("rentals.rentalCompleted"));
            fetchRentals(pagination.current, pagination.pageSize);
          } else {
            throw new Error(getApiErrorMessage(response.data?.error, t("rentals.finishFailed")));
          }
        } catch (error: any) {
          console.error("完成租用失败:", error);
          message.error(
            getApiErrorMessage(error.response?.data?.error, t("rentals.finishRentalFailed"))
          );
        }
      },
    });
  };

  // 查看消息
  const handleViewMessages = (rental: Rental) => {
    setSelectedRental(rental);
    setMessagesModalVisible(true);
    fetchRentalMessages(rental);
  };

  // 延长租用
  const handleExtendClick = (rental: Rental) => {
    setSelectedRental(rental);
    setExtendModalVisible(true);
    setExtendHours(4);
    fetchExtendInfo(rental, 4);
  };

  // 获取国家名称
  const getCountryName = (countryId: number) => {
    const country = countriesData?.find((c) => c.id === countryId);
    return country ? getLocalizedName(country) : t("rentals.country", { id: countryId });
  };

  // 获取状态标签
  const getStatusTag = (status: string, isExpired: boolean) => {
    if (isExpired && status === "active") {
      return <Tag color="red">{t("rentals.expired")}</Tag>;
    }

    switch (status) {
      case "active":
        return <Tag color="green">{t("rentals.active")}</Tag>;
      case "completed":
        return <Tag color="blue">{t("rentals.completed")}</Tag>;
      case "cancelled":
        return <Tag color="orange">{t("rentals.cancelled")}</Tag>;
      case "expired":
        return <Tag color="red">{t("rentals.expired")}</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 计算剩余时间
  const getRemainingTime = (endTime: string) => {
    const end = moment(endTime);
    const now = moment();
    const duration = moment.duration(end.diff(now));

    if (duration.asSeconds() <= 0) {
      return t("rentals.expired");
    }

    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    return t("rentals.timeRemaining", { hours, minutes });
  };

  // 获取时间进度
  const getTimeProgress = (startTime: string, endTime: string) => {
    const start = moment(startTime);
    const end = moment(endTime);
    const now = moment();

    const total = end.diff(start);
    const elapsed = now.diff(start);
    const percent = Math.min(100, Math.max(0, (elapsed / total) * 100));

    return Math.round(percent);
  };

  // 表格列定义 - 移动端优化
  const columns: ColumnsType<Rental> = [
    {
      title: t("rentals.phoneNumber"),
      dataIndex: "phone",
      key: "phone",
      width: 120,
      render: (phone) => (
        <Text code copyable={{ text: phone }} style={{ fontSize: "12px" }}>
          <PhoneOutlined style={{ marginRight: 4, fontSize: "12px" }} />
          {phone}
        </Text>
      ),
    },
    {
      title: t("rentals.service"),
      dataIndex: "service",
      key: "service",
      width: 80,
      render: (service) => (
        <Tag color="blue" style={{ fontSize: "11px", padding: "2px 6px" }}>
          {service}
        </Tag>
      ),
    },
    {
      title: t("rentals.country"),
      dataIndex: "country_id",
      key: "country_id",
      width: 80,
      render: (countryId) => <span style={{ fontSize: "12px" }}>{getCountryName(countryId)}</span>,
    },
    {
      title: t("rentals.duration"),
      dataIndex: "time_hours",
      key: "time_hours",
      width: 60,
      render: (hours) => (
        <span style={{ fontSize: "12px" }}>{t("rentals.hours", { count: hours })}</span>
      ),
    },
    {
      title: t("rentals.price"),
      dataIndex: "price",
      key: "price",
      width: 70,
      render: (price) => (
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>${price.toFixed(2)}</span>
      ),
    },
    {
      title: t("rentals.status"),
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status, record) => getStatusTag(status, record.is_expired),
    },
    {
      title: t("rentals.remainingTime"),
      key: "remaining",
      width: 100,
      render: (_, record) => {
        if (record.status !== "active" || record.is_expired) {
          return <span style={{ fontSize: "12px" }}>-</span>;
        }
        const remaining = getRemainingTime(record.expires_at);
        const progress = getTimeProgress(record.created_at, record.expires_at);

        return (
          <div>
            <div style={{ fontSize: "12px", marginBottom: "2px" }}>{remaining}</div>
            <Progress
              percent={progress}
              size="small"
              status={progress > 80 ? "exception" : progress > 60 ? "normal" : "success"}
              showInfo={false}
              style={{ fontSize: "10px" }}
            />
          </div>
        );
      },
    },
    {
      title: t("rentals.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      width: 100,
      render: (time) => (
        <span style={{ fontSize: "12px" }}>{moment(time).format("MM-DD HH:mm")}</span>
      ),
    },
    {
      title: t("rentals.actions"),
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title={t("rentals.viewMessages")}>
            <Button
              type="text"
              icon={<MessageOutlined />}
              onClick={() => handleViewMessages(record)}
              size="small"
              style={{ padding: "4px 8px" }}
            />
          </Tooltip>

          {record.status === "active" && !record.is_expired && (
            <>
              <Tooltip title={t("rentals.extendRental")}>
                <Button
                  type="text"
                  icon={<ClockCircleOutlined />}
                  onClick={() => handleExtendClick(record)}
                  size="small"
                  style={{ padding: "4px 8px" }}
                />
              </Tooltip>

              <Tooltip title={t("rentals.finishRental")}>
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleFinishRental(record)}
                  size="small"
                  style={{ padding: "4px 8px" }}
                />
              </Tooltip>

              <Tooltip title={t("rentals.cancelRental")}>
                <Button
                  type="text"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleCancelRental(record)}
                  size="small"
                  style={{ padding: "4px 8px" }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    fetchRentals();
  }, [fetchRentals]);

  // 延长小时数变化时获取价格
  useEffect(() => {
    if (selectedRental && extendModalVisible) {
      fetchExtendInfo(selectedRental, extendHours);
    }
  }, [extendHours, selectedRental, extendModalVisible]);

  // 统计数据
  const stats = {
    total: rentals?.length || 0,
    active: rentals?.filter((r) => r.status === "active" && !r.is_expired)?.length || 0,
    expired: rentals?.filter((r) => r.status === "expired" || r.is_expired)?.length || 0,
    cancelled: rentals?.filter((r) => r.status === "cancelled")?.length || 0,
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: "20px" }}>
        <Title level={2} style={{ fontSize: "20px", marginBottom: "8px" }}>
          <PhoneOutlined style={{ marginRight: "8px", color: "#722ed1" }} />
          {t("rentals.myRentalRecords")}
        </Title>
        <Paragraph type="secondary" style={{ fontSize: "14px", marginBottom: 0 }}>
          {t("rentals.manageRentalRecords")}
        </Paragraph>
      </div>

      {/* 统计卡片 - 移动端优化 */}
      <Row gutter={[8, 8]} style={{ marginBottom: "20px" }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic
              title={t("rentals.totalRentals")}
              value={stats.total}
              prefix={<PhoneOutlined style={{ fontSize: "16px" }} />}
              valueStyle={{ fontSize: "18px" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic
              title={t("rentals.activeRentals")}
              value={stats.active}
              valueStyle={{ color: "#3f8600", fontSize: "18px" }}
              prefix={<PlayCircleOutlined style={{ fontSize: "16px" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic
              title={t("rentals.expiredRentals")}
              value={stats.expired}
              valueStyle={{ color: "#cf1322", fontSize: "18px" }}
              prefix={<ClockCircleOutlined style={{ fontSize: "16px" }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ textAlign: "center" }}>
            <Statistic
              title={t("rentals.cancelledRentals")}
              value={stats.cancelled}
              valueStyle={{ color: "#1890ff", fontSize: "18px" }}
              prefix={<PlayCircleOutlined style={{ fontSize: "16px" }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤器 - 移动端优化 */}
      <Card size="small" style={{ marginBottom: "20px" }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t("rentals.statusFilter")}
              allowClear
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: "100%" }}
              size="small"
            >
              <Select.Option value="active">{t("rentals.active")}</Select.Option>
              <Select.Option value="expired">{t("rentals.expired")}</Select.Option>
              <Select.Option value="completed">{t("rentals.completed")}</Select.Option>
              <Select.Option value="cancelled">{t("rentals.cancelled")}</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder={t("rentals.serviceFilter")}
              allowClear
              value={filters.service || ""}
              onChange={(e) => setFilters({ ...filters, service: e.target.value || null })}
              size="small"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t("rentals.countryFilter")}
              allowClear
              showSearch
              value={filters.country}
              onChange={(value) => setFilters({ ...filters, country: value })}
              style={{ width: "100%" }}
              size="small"
              filterOption={(input, option) => {
                const result = option?.children
                  ?.toString()
                  .toLowerCase()
                  .includes(input.toLowerCase());
                return result || false;
              }}
            >
              {countriesData?.map((country) => (
                <Select.Option key={country.id} value={country.id}>
                  {getLocalizedName(country)}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchRentals(pagination.current, pagination.pageSize)}
              size="small"
              style={{ width: "100%" }}
            >
              {t("rentals.refresh")}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 租用列表 - 移动端优化 */}
      <Card size="small">
        <Table
          columns={columns}
          dataSource={rentals || []}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          size="small"
          pagination={{
            ...pagination,
            showSizeChanger: false,
            showQuickJumper: false,
            simple: true,
            showTotal: (total, range) => (
              <span style={{ fontSize: "12px" }}>
                {t("rentals.paginationText", { start: range[0], end: range[1], total })}
              </span>
            ),
            onChange: fetchRentals,
            onShowSizeChange: (current, size) => fetchRentals(current, size),
            pageSizeOptions: ["10", "20", "50"],
            size: "small",
          }}
        />
      </Card>

      {/* 消息查看模态框 - 移动端优化 */}
      <Modal
        title={
          <div style={{ fontSize: "16px" }}>
            <MessageOutlined style={{ marginRight: 8 }} />
            {selectedRental?.phone_number} - {t("rentals.smsRecords")}
          </div>
        }
        open={messagesModalVisible}
        onCancel={() => setMessagesModalVisible(false)}
        footer={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => {
              if (selectedRental) fetchRentalMessages(selectedRental);
            }}
            size="small"
          >
            {t("rentals.refresh")}
          </Button>,
          <Button key="close" onClick={() => setMessagesModalVisible(false)} size="small">
            {t("rentals.close")}
          </Button>,
        ]}
        width="95%"
        style={{ top: 20 }}
      >
        {messagesLoading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <ReloadOutlined spin style={{ fontSize: "24px" }} />
            <div style={{ marginTop: "16px" }}>{t("rentals.loading")}</div>
          </div>
        ) : messages?.length > 0 ? (
          <List
            itemLayout="vertical"
            dataSource={messages || []}
            renderItem={(message, index) => (
              <List.Item key={index}>
                <List.Item.Meta
                  title={
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text strong>
                        {t("rentals.from")}: {message.phoneFrom}
                      </Text>
                      <Text type="secondary">
                        {moment(message.date).format("YYYY-MM-DD HH:mm:ss")}
                      </Text>
                    </div>
                  }
                  description={
                    <div>
                      <Tag color="blue">{message.service}</Tag>
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "8px",
                          backgroundColor: "#f5f5f5",
                          borderRadius: "4px",
                        }}
                      >
                        {message.text}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <MessageOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
            <div style={{ marginTop: "16px", color: "#999" }}>{t("rentals.noSmsRecords")}</div>
          </div>
        )}
      </Modal>

      {/* 延长租用模态框 - 移动端优化 */}
      <Modal
        title={
          <div style={{ fontSize: "16px" }}>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            {t("rentals.extendRental")} - {selectedRental?.phone_number}
          </div>
        }
        open={extendModalVisible}
        onCancel={() => setExtendModalVisible(false)}
        onOk={handleExtendRental}
        confirmLoading={extendLoading}
        okText={t("rentals.confirmExtend")}
        cancelText={t("rentals.cancel")}
        width="95%"
        style={{ top: 20 }}
      >
        <div style={{ marginBottom: "16px" }}>
          <Text style={{ display: "block", marginBottom: "8px" }}>
            {t("rentals.extendTimeHours")}:
          </Text>
          <Input
            type="number"
            min={4}
            max={1344}
            value={extendHours}
            onChange={(e) => setExtendHours(parseInt(e.target.value) || 4)}
            style={{ width: "100%", maxWidth: "200px" }}
            addonAfter={t("rentals.hours")}
            size="small"
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <Text style={{ display: "block", marginBottom: "4px" }}>{t("rentals.extendCost")}:</Text>
          <Text strong style={{ color: "#722ed1", fontSize: "18px" }}>
            ${extendPrice.toFixed(2)}
          </Text>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <Text style={{ display: "block", marginBottom: "4px" }}>
            {t("rentals.currentBalance")}:
          </Text>
          <Text style={{ fontSize: "16px" }}>
            ${(user?.balance && typeof user.balance === "number" ? user.balance : 0).toFixed(2)}
          </Text>
        </div>

        {extendPrice > (user?.balance || 0) && (
          <div style={{ color: "#ff4d4f", marginBottom: "16px", fontSize: "14px" }}>
            {t("rentals.insufficientBalanceRecharge")}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RentalsPage;
