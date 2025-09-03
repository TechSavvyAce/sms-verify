import React, { useState, useEffect } from "react";
import { Card, Typography, Table, Button, Tag, Space, message, Modal, InputNumber } from "antd";
import { WalletOutlined, CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { userApi, paymentApi } from "../../services/api";
import api from "../../services/api";
import { Transaction, PaginatedResponse } from "../../types";

const { Title, Text } = Typography;

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<number>(0);
  const [confirming, setConfirming] = useState(false);

  // 获取交易记录
  const fetchTransactions = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await userApi.getTransactions({
        page,
        limit: pageSize,
      });

      if (response.success && response.data) {
        const data = response.data as PaginatedResponse<Transaction>;
        setTransactions(data.data);
        setPagination({
          current: data.pagination.page,
          pageSize: data.pagination.limit,
          total: data.pagination.total,
        });
      } else {
        const errorMsg = typeof response.error === "string" ? response.error : "获取交易记录失败";
        message.error(errorMsg);
      }
    } catch (error) {
      console.error("获取交易记录失败:", error);
      message.error("获取交易记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // 检查是否有过期的待处理交易
    checkExpiredTransactions();
  }, []);

  // 检查过期交易
  const checkExpiredTransactions = async () => {
    try {
      await api.get("/payment/check-pending");
    } catch (error) {
      console.error("检查过期交易失败:", error);
    }
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    fetchTransactions(pagination.current, pagination.pageSize);
  };

  // 打开确认支付模态框
  const handleConfirmPayment = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setConfirmAmount(transaction.amount);
    setConfirmModalVisible(true);
  };

  // 检查交易是否即将过期
  const isTransactionExpiringSoon = (transaction: Transaction) => {
    if (transaction.status !== "pending") return false;
    const timeRemaining = getTimeRemaining(transaction.created_at);
    if (!timeRemaining) return false;
    const hours = parseInt(timeRemaining.split("小时")[0]);
    return hours < 2; // 少于2小时
  };

  // 确认支付
  const handleConfirmPaymentSubmit = async () => {
    if (!selectedTransaction || !selectedTransaction.reference_id) {
      message.error("交易信息不完整");
      return;
    }

    setConfirming(true);
    try {
      const response = await paymentApi.confirmPayment({
        payment_id: selectedTransaction.reference_id,
        amount: confirmAmount,
      });

      if (response.success) {
        message.success("支付确认成功！");
        setConfirmModalVisible(false);
        setSelectedTransaction(null);
        // 刷新交易记录
        fetchTransactions(pagination.current, pagination.pageSize);
      } else {
        const errorMsg = typeof response.error === "string" ? response.error : "支付确认失败";
        message.error(errorMsg);
      }
    } catch (error) {
      console.error("支付确认失败:", error);
      message.error("支付确认失败");
    } finally {
      setConfirming(false);
    }
  };

  // 计算剩余时间
  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const timeDiff = 24 * 60 * 60 * 1000 - (now.getTime() - created.getTime()); // 24小时
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (timeDiff <= 0) return null;
    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
  };

  // 获取交易状态标签
  const getStatusTag = (transaction: Transaction) => {
    if (transaction.type === "recharge") {
      if (transaction.status === "pending") {
        const timeRemaining = getTimeRemaining(transaction.created_at);
        return (
          <div>
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              待确认
            </Tag>
            {timeRemaining && (
              <div style={{ fontSize: "11px", color: "#ff4d4f", marginTop: "2px" }}>
                剩余: {timeRemaining}
              </div>
            )}
          </div>
        );
      } else if (transaction.status === "completed") {
        return (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            已完成
          </Tag>
        );
      } else if (transaction.status === "failed") {
        return <Tag color="red">失败</Tag>;
      } else if (transaction.status === "expired") {
        return <Tag color="gray">已过期</Tag>;
      }
    }
    return <Tag color="blue">已完成</Tag>;
  };

  // 获取交易类型显示名称
  const getTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      recharge: "充值",
      activation: "激活消费",
      rental: "租用消费",
      refund: "退款",
      adjustment: "余额调整",
    };
    return typeMap[type] || type;
  };

  // 表格列定义
  const columns = [
    {
      title: "交易ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => getTypeDisplay(type),
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_: any, record: Transaction) => getStatusTag(record),
    },
    {
      title: "余额变化",
      key: "balance_change",
      width: 150,
      render: (_: any, record: Transaction) => {
        if (record.balance_before !== undefined && record.balance_after !== undefined) {
          const change = record.balance_after - record.balance_before;
          const color = change >= 0 ? "green" : "red";
          return (
            <Text style={{ color }}>
              {record.balance_before.toFixed(2)} → {record.balance_after.toFixed(2)}
            </Text>
          );
        }
        return "-";
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
    },
    {
      title: "操作",
      key: "action",
      width: 120,
      render: (_: any, record: Transaction) => {
        // 只有充值类型且状态为pending的交易才显示确认按钮
        if (record.type === "recharge" && record.status === "pending") {
          return (
            <Button type="primary" size="small" onClick={() => handleConfirmPayment(record)}>
              确认支付
            </Button>
          );
        }
        // 对于过期的交易，显示过期提示
        if (record.type === "recharge" && record.status === "expired") {
          return (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              已过期
            </Text>
          );
        }
        return "-";
      },
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        交易记录
      </Title>

      <Card>
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 确认支付模态框 */}
      <Modal
        title="确认支付"
        open={confirmModalVisible}
        onOk={handleConfirmPaymentSubmit}
        onCancel={() => setConfirmModalVisible(false)}
        confirmLoading={confirming}
        okText="确认"
        cancelText="取消"
      >
        {selectedTransaction && (
          <div>
            <p>请确认您已完成支付：</p>
            <p>
              <strong>交易ID:</strong> {selectedTransaction.id}
            </p>
            <p>
              <strong>支付金额:</strong> ¥{selectedTransaction.amount.toFixed(2)}
            </p>
            <p>
              <strong>支付ID:</strong> {selectedTransaction.reference_id}
            </p>
            {isTransactionExpiringSoon(selectedTransaction) && (
              <div
                style={{
                  backgroundColor: "#fff2e8",
                  border: "1px solid #ffbb96",
                  borderRadius: "4px",
                  padding: "8px",
                  margin: "8px 0",
                }}
              >
                <Text type="warning">⚠️ 此交易即将过期，请尽快确认支付！</Text>
              </div>
            )}
            <br />
            <p>确认金额：</p>
            <InputNumber
              value={confirmAmount}
              onChange={(value) => setConfirmAmount(value || 0)}
              precision={2}
              style={{ width: "100%" }}
              addonBefore="¥"
            />
            <p style={{ marginTop: 8, color: "#666", fontSize: "12px" }}>
              请确保您已完成支付，确认后将立即到账
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsPage;
