import React, { useState, useEffect } from "react";
import { Card, Typography, Table, Tag, message, Statistic } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, DollarOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { userApi } from "../../services/api";
import api from "../../services/api";
import { Transaction, PaginatedResponse } from "../../types";
import { useAuthStore } from "../../stores/authStore";

const { Title, Text } = Typography;

const TransactionsPage: React.FC = () => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const { user, updateBalance } = useAuthStore();

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
        const errorMsg =
          typeof response.error === "string"
            ? response.error
            : t("transactions.fetchTransactionsFailed");
        message.error(errorMsg);
      }
    } catch (error) {
      console.error("获取交易记录失败:", error);
      message.error(t("transactions.fetchTransactionsFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // 检查是否有过期的待处理交易
    checkExpiredTransactions();

    // 监听支付成功事件
    const handlePaymentSuccess = (event: CustomEvent) => {
      const data = event.detail;
      console.log("收到支付成功事件:", data);

      // 更新用户余额
      if (data.new_balance !== undefined) {
        updateBalance(0, data.new_balance);
      }

      // 刷新交易列表
      fetchTransactions();

      // 显示成功消息
      message.success(t("transactions.rechargeSuccess", { balance: data.new_balance }));
    };

    // 监听余额更新事件
    const handleBalanceUpdate = (data: any) => {
      console.log("收到余额更新事件:", data);

      // 更新用户余额
      if (data.new_balance !== undefined) {
        updateBalance(0, data.new_balance);
      }
    };

    // 监听支付过期事件
    const handlePaymentExpired = (data: any) => {
      console.log("收到支付过期事件:", data);
      message.warning(data.message);
      // 刷新交易列表以显示过期状态
      fetchTransactions();
    };

    // 添加事件监听器
    window.addEventListener("payment_success", handlePaymentSuccess as EventListener);
    window.addEventListener("balance_updated", handleBalanceUpdate as EventListener);
    window.addEventListener("payment_expired", handlePaymentExpired as EventListener);

    // 清理函数
    return () => {
      window.removeEventListener("payment_success", handlePaymentSuccess as EventListener);
      window.removeEventListener("balance_updated", handleBalanceUpdate as EventListener);
      window.removeEventListener("payment_expired", handlePaymentExpired as EventListener);
    };
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

  // 计算剩余时间
  const getTimeRemaining = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const timeDiff = 30 * 60 * 1000 - (now.getTime() - created.getTime()); // 30分钟
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (timeDiff <= 0) return null;
    if (hours > 0) return t("transactions.timeRemainingHours", { hours, minutes });
    return t("transactions.timeRemainingMinutes", { minutes });
  };

  // 获取交易状态标签
  const getStatusTag = (transaction: Transaction) => {
    if (transaction.type === "recharge") {
      if (transaction.status === "pending") {
        const timeRemaining = getTimeRemaining(transaction.created_at);
        return (
          <div>
            <Tag color="orange" icon={<ClockCircleOutlined />}>
              {t("transactions.pending")}
            </Tag>
            {timeRemaining && (
              <div style={{ fontSize: "11px", color: "#ff4d4f", marginTop: "2px" }}>
                {t("transactions.remaining")}: {timeRemaining}
              </div>
            )}
          </div>
        );
      } else if (transaction.status === "completed") {
        return (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            {t("transactions.completed")}
          </Tag>
        );
      } else if (transaction.status === "failed") {
        return <Tag color="red">{t("transactions.failed")}</Tag>;
      } else if (transaction.status === "expired") {
        return <Tag color="gray">{t("transactions.expired")}</Tag>;
      }
    }
    return <Tag color="blue">{t("transactions.completed")}</Tag>;
  };

  // 获取交易类型显示名称
  const getTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      recharge: t("transactions.accountRecharge"),
      activation: t("transactions.smsConsumption"),
      rental: t("transactions.numberRental"),
      refund: t("transactions.refund"),
      adjustment: t("transactions.balanceAdjustment"),
    };
    return typeMap[type] || type;
  };

  // 表格列定义
  const columns = [
    {
      title: t("transactions.paymentId"),
      dataIndex: "reference_id",
      key: "reference_id",
      width: 200,
      render: (referenceId: string) => referenceId || "-",
    },
    {
      title: t("transactions.type"),
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => getTypeDisplay(type),
    },
    {
      title: t("transactions.amount"),
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (amount: number) => `$${amount.toFixed(2)}`,
    },
    {
      title: t("transactions.status"),
      key: "status",
      width: 100,
      render: (_: any, record: Transaction) => getStatusTag(record),
    },
    {
      title: t("transactions.balanceChange"),
      key: "balance_change",
      width: 150,
      render: (_: any, record: Transaction) => {
        // 只有状态为completed或paid的交易才显示余额变化
        if (
          record.status === "completed" &&
          record.balance_before !== undefined &&
          record.balance_after !== undefined
        ) {
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
      title: t("transactions.description"),
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: t("transactions.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        {t("transactions.transactionRecords")}
      </Title>

      {/* 余额显示卡片 */}
      <Card style={{ marginBottom: "24px" }}>
        <Statistic
          title={t("transactions.currentBalance")}
          value={user?.balance || 0}
          precision={2}
          prefix={<DollarOutlined />}
          valueStyle={{ color: "#3f8600" }}
        />
      </Card>

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
            showTotal: (total, range) =>
              t("transactions.paginationText", { start: range[0], end: range[1], total }),
          }}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default TransactionsPage;
