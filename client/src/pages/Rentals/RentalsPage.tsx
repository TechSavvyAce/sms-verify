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
        message.error(getApiErrorMessage(error.response?.data?.error, "获取租用列表失败"));
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
      message.error(getApiErrorMessage(error.response?.data?.error, "获取消息失败"));
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
        message.success("租用延长成功");
        setExtendModalVisible(false);
        fetchRentals(pagination.current, pagination.pageSize);
      } else {
        throw new Error(getApiErrorMessage(response.data?.error, "延长失败"));
      }
    } catch (error: any) {
      console.error("延长租用失败:", error);
      message.error(getApiErrorMessage(error.response?.data?.error, "延长租用失败"));
    } finally {
      setExtendLoading(false);
    }
  };

  // 取消租用
  const handleCancelRental = async (rental: Rental) => {
    Modal.confirm({
      title: "确认取消租用",
      content: (
        <div>
          <p>您确定要取消这个租用吗？</p>
          <p>号码: {rental.phone_number}</p>
          <p style={{ color: "#ff4d4f" }}>
            注意：租用超过20分钟后不能取消，取消后将收取10%的手续费。
          </p>
        </div>
      ),
      onOk: async () => {
        try {
          const response = await rentalApi.cancel(rental.id);

          if (response.data?.success) {
            message.success("租用已取消");
            fetchRentals(pagination.current, pagination.pageSize);
          } else {
            throw new Error(getApiErrorMessage(response.data?.error, "取消失败"));
          }
        } catch (error: any) {
          console.error("取消租用失败:", error);
          message.error(getApiErrorMessage(error.response?.data?.error, "取消租用失败"));
        }
      },
    });
  };

  // 完成租用
  const handleFinishRental = async (rental: Rental) => {
    Modal.confirm({
      title: "确认完成租用",
      content: (
        <div>
          <p>您确定要完成这个租用吗？</p>
          <p>号码: {rental.phone_number}</p>
          <p>完成后将无法继续接收短信。</p>
        </div>
      ),
      onOk: async () => {
        try {
          const response = await rentalApi.finish(rental.id);

          if (response.data?.success) {
            message.success("租用已完成");
            fetchRentals(pagination.current, pagination.pageSize);
          } else {
            throw new Error(getApiErrorMessage(response.data?.error, "完成失败"));
          }
        } catch (error: any) {
          console.error("完成租用失败:", error);
          message.error(getApiErrorMessage(error.response?.data?.error, "完成租用失败"));
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
    return country?.name_cn || country?.name || `国家 ${countryId}`;
  };

  // 获取状态标签
  const getStatusTag = (status: string, isExpired: boolean) => {
    if (isExpired && status === "active") {
      return <Tag color="red">已过期</Tag>;
    }

    switch (status) {
      case "active":
        return <Tag color="green">活跃</Tag>;
      case "completed":
        return <Tag color="blue">已完成</Tag>;
      case "cancelled":
        return <Tag color="orange">已取消</Tag>;
      case "expired":
        return <Tag color="red">已过期</Tag>;
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
      return "已过期";
    }

    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    return `${hours}小时${minutes}分钟`;
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

  // 表格列定义
  const columns: ColumnsType<Rental> = [
    {
      title: "号码",
      dataIndex: "phone",
      key: "phone",
      render: (phone) => (
        <Text code copyable={{ text: phone }}>
          <PhoneOutlined style={{ marginRight: 8 }} />
          {phone}
        </Text>
      ),
    },
    {
      title: "服务",
      dataIndex: "service",
      key: "service",
      render: (service) => <Tag color="blue">{service}</Tag>,
    },
    {
      title: "国家",
      dataIndex: "country_id",
      key: "country_id",
      render: (countryId) => getCountryName(countryId),
    },
    {
      title: "时长",
      dataIndex: "time_hours",
      key: "time_hours",
      render: (hours) => `${hours}小时`,
    },
    {
      title: "价格",
      dataIndex: "price",
      key: "price",
      render: (price) => `$${price.toFixed(2)}`,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status, record) => getStatusTag(status, record.is_expired),
    },
    {
      title: "剩余时间",
      key: "remaining",
      render: (_, record) => {
        if (record.status !== "active" || record.is_expired) {
          return "-";
        }
        const remaining = getRemainingTime(record.expires_at);
        const progress = getTimeProgress(record.created_at, record.expires_at);

        return (
          <div>
            <div>{remaining}</div>
            <Progress
              percent={progress}
              size="small"
              status={progress > 80 ? "exception" : progress > 60 ? "normal" : "success"}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (time) => moment(time).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Tooltip title="查看消息">
            <Button
              type="text"
              icon={<MessageOutlined />}
              onClick={() => handleViewMessages(record)}
            />
          </Tooltip>

          {record.status === "active" && !record.is_expired && (
            <>
              <Tooltip title="延长租用">
                <Button
                  type="text"
                  icon={<ClockCircleOutlined />}
                  onClick={() => handleExtendClick(record)}
                />
              </Tooltip>

              <Tooltip title="完成租用">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleFinishRental(record)}
                />
              </Tooltip>

              <Tooltip title="取消租用">
                <Button
                  type="text"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleCancelRental(record)}
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
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>
          <PhoneOutlined style={{ marginRight: "12px", color: "#722ed1" }} />
          我的租用记录
        </Title>
        <Paragraph type="secondary">管理您的手机号码租用记录，查看消息和延长租用时间</Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: "24px" }}>
        <Col span={6}>
          <Card>
            <Statistic title="总租用数" value={stats.total} prefix={<PhoneOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃租用"
              value={stats.active}
              valueStyle={{ color: "#3f8600" }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已过期"
              value={stats.expired}
              valueStyle={{ color: "#cf1322" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已取消"
              value={stats.cancelled}
              valueStyle={{ color: "#1890ff" }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 过滤器 */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={16}>
          <Col span={6}>
            <Select
              placeholder="状态筛选"
              allowClear
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: "100%" }}
            >
              <Select.Option value="active">活跃</Select.Option>
              <Select.Option value="expired">已过期</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </Col>
          <Col span={6}>
            <Input
              placeholder="服务筛选"
              allowClear
              value={filters.service || ""}
              onChange={(e) => setFilters({ ...filters, service: e.target.value || null })}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="国家筛选"
              allowClear
              showSearch
              value={filters.country}
              onChange={(value) => setFilters({ ...filters, country: value })}
              style={{ width: "100%" }}
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
                  {country.name_cn || country.name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchRentals(pagination.current, pagination.pageSize)}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 租用列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={rentals || []}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: fetchRentals,
            onShowSizeChange: (current, size) => fetchRentals(current, size),
          }}
        />
      </Card>

      {/* 消息查看模态框 */}
      <Modal
        title={
          <div>
            <MessageOutlined style={{ marginRight: 8 }} />
            {selectedRental?.phone_number} - 短信记录
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
          >
            刷新
          </Button>,
          <Button key="close" onClick={() => setMessagesModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {messagesLoading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <ReloadOutlined spin style={{ fontSize: "24px" }} />
            <div style={{ marginTop: "16px" }}>加载中...</div>
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
                      <Text strong>来自: {message.phoneFrom}</Text>
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
            <div style={{ marginTop: "16px", color: "#999" }}>暂无短信记录</div>
          </div>
        )}
      </Modal>

      {/* 延长租用模态框 */}
      <Modal
        title={
          <div>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            延长租用 - {selectedRental?.phone_number}
          </div>
        }
        open={extendModalVisible}
        onCancel={() => setExtendModalVisible(false)}
        onOk={handleExtendRental}
        confirmLoading={extendLoading}
        okText="确认延长"
        cancelText="取消"
      >
        <div style={{ marginBottom: "16px" }}>
          <Text>延长时间（小时）：</Text>
          <Input
            type="number"
            min={4}
            max={1344}
            value={extendHours}
            onChange={(e) => setExtendHours(parseInt(e.target.value) || 4)}
            style={{ width: "200px", marginLeft: "8px" }}
            addonAfter="小时"
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <Text>延长费用：</Text>
          <Text strong style={{ color: "#722ed1", fontSize: "16px", marginLeft: "8px" }}>
            ${extendPrice.toFixed(2)}
          </Text>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <Text>当前余额：</Text>
          <Text style={{ marginLeft: "8px" }}>
            ${(user?.balance && typeof user.balance === "number" ? user.balance : 0).toFixed(2)}
          </Text>
        </div>

        {extendPrice > (user?.balance || 0) && (
          <div style={{ color: "#ff4d4f", marginBottom: "16px" }}>余额不足，请先充值</div>
        )}
      </Modal>
    </div>
  );
};

export default RentalsPage;
