import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Tag,
  Typography,
  Spin,
  message,
  Modal,
  Descriptions,
} from "antd";
import { SearchOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import { adminApi } from "../../services/api";
import { Transaction } from "../../types";
import { formatDateTime } from "../../utils/helpers";

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AdminTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    dateRange: null as [string, string] | null,
    search: "",
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Load transactions
  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };

      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.dateRange) {
        params.dateRange = filters.dateRange;
      }
      if (filters.search) params.search = filters.search;

      const response = await adminApi.getTransactions(params);
      if (response.success && response.data) {
        setTransactions(response.data.data || []);
        setTotal(response.data.pagination.total || 0);
      } else {
        message.error("获取交易记录失败");
      }
    } catch (error: any) {
      message.error("获取交易记录失败");
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and filter changes
  useEffect(() => {
    loadTransactions();
  }, [currentPage, pageSize, filters]);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    loadTransactions();
  };

  // Handle filter changes
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Handle date range change
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters((prev) => ({
        ...prev,
        dateRange: [dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")],
      }));
    } else {
      setFilters((prev) => ({ ...prev, dateRange: null }));
    }
    setCurrentPage(1);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      type: "",
      status: "",
      dateRange: null,
      search: "",
    });
    setCurrentPage(1);
  };

  // View transaction details
  const viewTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailModalVisible(true);
  };

  // Table columns
  const columns = [
    {
      title: "支付ID",
      dataIndex: "reference_id",
      key: "reference_id",
      width: 200,
      render: (referenceId: string) => referenceId || "-",
    },
    {
      title: "用户",
      key: "user",
      render: (record: Transaction) => {
        if (record.user) {
          return (
            <div>
              <div>ID: {record.user.id}</div>
              <div>用户名: {record.user.username}</div>
            </div>
          );
        }
        // Fallback to user_id if user object is not available
        if (record.user_id) {
          return `ID: ${record.user_id}`;
        }
        return "N/A";
      },
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (type: string) => {
        const typeMap: { [key: string]: { color: string; text: string } } = {
          recharge: { color: "orange", text: "账户充值" },
          activation: { color: "blue", text: "验证码消费" },
          rental: { color: "green", text: "号码租用" },
          refund: { color: "red", text: "退款" },
          adjustment: { color: "purple", text: "余额调整" },
        };
        const config = typeMap[type] || { color: "default", text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number) => (
        <span style={{ color: amount >= 0 ? "#52c41a" : "#ff4d4f" }}>
          {amount >= 0 ? "+" : ""}
          {amount.toFixed(2)}
        </span>
      ),
    },
    {
      title: "余额变化",
      key: "balance_change",
      render: (record: Transaction) => {
        // 只有状态为completed的交易才显示余额变化
        if (
          record.status === "completed" &&
          record.balance_before !== undefined &&
          record.balance_after !== undefined
        ) {
          return (
            <div>
              <div>前: {record.balance_before.toFixed(2)}</div>
              <div>后: {record.balance_after.toFixed(2)}</div>
            </div>
          );
        }
        return "-";
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const statusMap: { [key: string]: { color: string; text: string } } = {
          pending: { color: "orange", text: "待处理" },
          completed: { color: "green", text: "已完成" },
          failed: { color: "red", text: "失败" },
          cancelled: { color: "gray", text: "已取消" },
          expired: { color: "red", text: "已过期" },
        };
        const config = statusMap[status || ""] || { color: "default", text: status || "未知" };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => formatDateTime(date),
    },
    {
      title: "操作",
      key: "actions",
      render: (record: Transaction) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => viewTransactionDetail(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        交易管理
      </Title>

      {/* Filters */}
      <Card style={{ marginBottom: "16px" }}>
        <Space wrap size="middle">
          <Input
            placeholder="搜索用户或描述"
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
          />

          <Select
            placeholder="交易类型"
            value={filters.type}
            onChange={(value) => handleFilterChange("type", value)}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="recharge">账户充值</Option>
            <Option value="activation">验证码消费</Option>
            <Option value="rental">号码租用</Option>
            <Option value="refund">退款</Option>
            <Option value="adjustment">余额调整</Option>
          </Select>

          <Select
            placeholder="状态"
            value={filters.status}
            onChange={(value) => handleFilterChange("status", value)}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="completed">已完成</Option>
            <Option value="pending">处理中</Option>
            <Option value="failed">失败</Option>
          </Select>

          <RangePicker onChange={handleDateRangeChange} placeholder={["开始日期", "结束日期"]} />

          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>

          <Button onClick={resetFilters}>重置</Button>
        </Space>
      </Card>

      {/* Transactions Table */}
      <Card>
        <div style={{ marginBottom: "16px" }}>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadTransactions}>
              刷新
            </Button>
            <span>共 {total} 条记录</span>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
        />
      </Card>

      {/* Transaction Detail Modal */}
      <Modal
        title="交易详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedTransaction && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="支付ID">
              {selectedTransaction.reference_id || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="交易ID">{selectedTransaction.id}</Descriptions.Item>
            <Descriptions.Item label="用户信息">
              {selectedTransaction.user ? (
                <div>
                  <div>ID: {selectedTransaction.user.id}</div>
                  <div>用户名: {selectedTransaction.user.username}</div>
                  <div>邮箱: {selectedTransaction.user.email}</div>
                </div>
              ) : (
                "N/A"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="交易类型">
              {(() => {
                const typeMap: { [key: string]: { color: string; text: string } } = {
                  recharge: { color: "orange", text: "账户充值" },
                  activation: { color: "blue", text: "验证码消费" },
                  rental: { color: "green", text: "号码租用" },
                  refund: { color: "red", text: "退款" },
                  adjustment: { color: "purple", text: "余额调整" },
                };
                const config = typeMap[selectedTransaction.type] || {
                  color: "default",
                  text: selectedTransaction.type,
                };
                return <Tag color={config.color}>{config.text}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const statusMap: { [key: string]: { color: string; text: string } } = {
                  pending: { color: "orange", text: "待处理" },
                  completed: { color: "green", text: "已完成" },
                  failed: { color: "red", text: "失败" },
                  cancelled: { color: "gray", text: "已取消" },
                  expired: { color: "red", text: "已过期" },
                };
                const config = statusMap[selectedTransaction.status || ""] || {
                  color: "default",
                  text: selectedTransaction.status || "未知",
                };
                return <Tag color={config.color}>{config.text}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              <span style={{ color: selectedTransaction.amount >= 0 ? "#52c41a" : "#ff4d4f" }}>
                {selectedTransaction.amount >= 0 ? "+" : ""}
                {selectedTransaction.amount.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="余额变化">
              {selectedTransaction.status === "completed" &&
              selectedTransaction.balance_before !== undefined &&
              selectedTransaction.balance_after !== undefined
                ? `${selectedTransaction.balance_before.toFixed(2)} → ${selectedTransaction.balance_after.toFixed(2)}`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedTransaction.description || "无"}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatDateTime(selectedTransaction.created_at)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AdminTransactionsPage;
