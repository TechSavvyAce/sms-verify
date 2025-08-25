import React, { useState } from "react";
import { Modal, Form, Input, Button, Space, message, Typography, Row, Col, Tag } from "antd";
import { WalletOutlined, CheckCircleOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface AddFundsModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (amount: number) => void;
  currentBalance?: number;
}

const AddFundsModal: React.FC<AddFundsModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  currentBalance = 0,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [paymentUrl, setPaymentUrl] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "created" | "confirmed">("idle");

  const predefinedAmounts = [10, 25, 50, 100, 200, 500];

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = parseFloat(value);
    setSelectedAmount(isNaN(numValue) || numValue <= 0 ? 0 : numValue);
  };

  const handleCreatePayment = async () => {
    if (selectedAmount <= 0) {
      message.error("请选择或输入充值金额");
      return;
    }

    try {
      setLoading(true);

      // Create payment using our backend API endpoint
      const token = localStorage.getItem("token");
      const response = await fetch(`https://www.safeping.xyz/api/payment/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service_name: "SMS Verification Service",
          description: `账户充值 - $${selectedAmount.toFixed(2)}`,
          amount: selectedAmount,
          webhook_url: `${window.location.origin}/api/webhooks/payment`,
          language: "zh-CN",
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment creation failed: ${response.status}`);
      }

      const paymentData = await response.json();

      setPaymentUrl(paymentData.payment_url);
      setQrCode(paymentData.qr_code);
      setPaymentId(paymentData.payment_id);
      setPaymentStatus("created");

      message.success("支付订单创建成功！");
    } catch (error) {
      console.error("Payment creation failed:", error);
      message.error("创建支付订单失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("已复制到剪贴板");
  };

  const handlePaymentSuccess = async () => {
    try {
      setLoading(true);

      // Call the payment confirmation API
      const token = localStorage.getItem("token");
      const response = await fetch(`https://www.safeping.xyz/api/payment/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_id: paymentId,
          amount: selectedAmount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "支付确认失败");
      }

      const result = await response.json();

      if (result.success) {
        setPaymentStatus("confirmed");
        message.success(`充值成功！已到账 $${selectedAmount.toFixed(2)}`);

        // Call the success callback to refresh user data
        onSuccess(selectedAmount);

        // Close the modal
        handleClose();
      } else {
        throw new Error(result.error || "支付确认失败");
      }
    } catch (error: any) {
      console.error("Payment confirmation failed:", error);
      message.error(error.message || "支付确认失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAmount(0);
    setPaymentUrl("");
    setQrCode("");
    setPaymentId("");
    setPaymentStatus("idle");
    onCancel();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center" }}>
          <WalletOutlined style={{ marginRight: "8px", color: "#1890ff" }} />
          账户充值
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <WalletOutlined style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }} />
        <Title level={3}>选择充值金额</Title>
        <Text type="secondary">当前余额: ${currentBalance.toFixed(2)}</Text>
      </div>

      <Form layout="vertical">
        <Form.Item label="选择金额" required>
          <div style={{ marginBottom: "16px" }}>
            <Space wrap>
              {predefinedAmounts.map((amount) => (
                <Button
                  key={amount}
                  type={selectedAmount === amount ? "primary" : "default"}
                  size="large"
                  onClick={() => handleAmountSelect(amount)}
                  style={{ minWidth: "80px" }}
                >
                  ${amount}
                </Button>
              ))}
            </Space>
          </div>

          <div style={{ marginTop: "16px" }}>
            <Text strong>自定义金额:</Text>
            <Input
              placeholder="输入充值金额"
              prefix="$"
              suffix="USD"
              value={selectedAmount > 0 ? selectedAmount.toString() : ""}
              onChange={handleCustomAmountChange}
              style={{ marginTop: "8px" }}
            />
          </div>
        </Form.Item>

        {selectedAmount > 0 && (
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            {paymentStatus === "idle" && (
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleCreatePayment}
                icon={<WalletOutlined />}
                style={{ minWidth: "200px" }}
              >
                创建支付订单 (${selectedAmount.toFixed(2)})
              </Button>
            )}

            {paymentStatus === "created" && (
              <div style={{ marginBottom: "16px" }}>
                <Text type="success" strong>
                  ✅ 支付订单已创建，请完成支付
                </Text>
              </div>
            )}

            {paymentStatus === "confirmed" && (
              <div style={{ marginBottom: "16px" }}>
                <Text type="success" strong>
                  🎉 支付已确认，正在处理...
                </Text>
              </div>
            )}
          </div>
        )}

        {paymentUrl && (
          <>
            <div
              style={{
                marginBottom: "16px",
                padding: "16px",
                background: "#f0f8ff",
                borderRadius: "8px",
              }}
            >
              <Text strong style={{ color: "#1890ff" }}>
                📱 支付说明：请使用以下方式之一完成支付
              </Text>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <Text strong>支付链接:</Text>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <Input value={paymentUrl} readOnly style={{ flex: 1 }} />
                <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(paymentUrl)}>
                  复制
                </Button>
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={() => window.open(paymentUrl, "_blank")}
                >
                  打开
                </Button>
              </div>
            </div>

            {qrCode && (
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <Text strong>二维码支付:</Text>
                <div style={{ marginTop: "8px" }}>
                  <img
                    src={qrCode}
                    alt="Payment QR Code"
                    style={{ width: "200px", height: "200px" }}
                  />
                </div>
                <Text type="secondary" style={{ display: "block", marginTop: "8px" }}>
                  使用支持加密货币的钱包扫描二维码进行支付
                </Text>
              </div>
            )}

            <div style={{ textAlign: "center" }}>
              <Button
                type="primary"
                size="large"
                loading={loading}
                icon={<CheckCircleOutlined />}
                onClick={handlePaymentSuccess}
                style={{ minWidth: "200px" }}
              >
                我已支付完成
              </Button>
            </div>

            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                background: "#f6ffed",
                borderRadius: "6px",
              }}
            >
              <Text type="secondary" style={{ fontSize: "12px" }}>
                <strong>支付说明：</strong>
                <br />
                • 支付完成后，点击"我已支付完成"按钮
                <br />
                • 系统将自动确认并更新您的余额
                <br />
                • 支付订单30分钟后自动过期
                <br />• 如遇问题，请联系客服并提供支付ID: {paymentId}
              </Text>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default AddFundsModal;
