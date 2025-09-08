import React, { useState } from "react";
import { Modal, Form, Input, Button, Space, message, Typography, Row, Col, Tag } from "antd";
import { WalletOutlined, CheckCircleOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [paymentUrl, setPaymentUrl] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "created" | "pending" | "failed" | "confirmed"
  >("idle");

  const predefinedAmounts = [10, 25, 50, 100, 200, 500];

  // Fix malformed URLs with double slashes
  const sanitizeUrl = (url: string): string => {
    if (!url) return url;
    return url.replace(/(https?:\/\/[^\/]+)\/\//, "$1/");
  };

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
      message.error(t("balance.selectAmountError"));
      return;
    }

    try {
      setLoading(true);

      // Create payment using our backend API endpoint
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5001/api"}/payment/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            service_name: "SMS Verification Service",
            description: t("balance.paymentDescription", { amount: selectedAmount.toFixed(2) }),
            amount: selectedAmount,
            webhook_url: `${process.env.REACT_SAFEPING_API_URL || process.env.REACT_APP_API_URL || "http://localhost:5001"}/webhook/safeping`,
            language: "zh-CN",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Payment creation failed: ${response.status}`);
      }

      const paymentData = await response.json();

      console.log("Payment creation response:", paymentData);

      // Access data from the nested structure returned by the backend
      const { payment_url, qr_code, payment_id } = paymentData.data || paymentData;

      setPaymentUrl(sanitizeUrl(payment_url));
      setQrCode(qr_code);
      setPaymentId(payment_id);
      setPaymentStatus("created");

      message.success(t("balance.paymentOrderCreated"));
    } catch (error) {
      console.error("Payment creation failed:", error);
      message.error(t("balance.paymentOrderFailed"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success(t("balance.copiedToClipboard"));
  };

  const handlePaymentSuccess = async () => {
    try {
      setLoading(true);

      // First, check the payment status via our backend API
      const token = localStorage.getItem("token");
      const paymentStatusResponse = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:5001/api"}/payment/check-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_id: paymentId,
          }),
        }
      );

      if (!paymentStatusResponse.ok) {
        throw new Error(t("balance.cannotCheckPaymentStatus"));
      }

      const paymentStatusData = await paymentStatusResponse.json();

      if (!paymentStatusData.success || !paymentStatusData.payment) {
        throw new Error(t("balance.paymentStatusCheckFailed"));
      }

      const payment = paymentStatusData.payment;

      // Check if payment is completed
      if (payment.status === "completed" || payment.status === "paid") {
        // Payment is completed, call our confirmation API
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:5001/api"}/payment/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              payment_id: paymentId,
              amount: selectedAmount,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("balance.paymentConfirmationFailed"));
        }

        const result = await response.json();

        if (result.success) {
          setPaymentStatus("confirmed");
          message.success(t("balance.paymentSuccess", { amount: selectedAmount.toFixed(2) }));

          // Call the success callback to refresh user data
          onSuccess(selectedAmount);

          // Close the modal
          handleClose();
        } else {
          throw new Error(result.error || t("balance.paymentConfirmationFailed"));
        }
      } else if (payment.status === "pending") {
        // Payment is still pending
        message.warning(t("balance.paymentPending"));
        setPaymentStatus("pending");

        // Close the modal after showing the message
        setTimeout(() => {
          handleClose();
        }, 2000); // Close after 2 seconds
      } else if (payment.status === "failed" || payment.status === "cancelled") {
        // Payment failed or was cancelled
        message.error(
          t("balance.paymentFailedOrCancelled", {
            status: payment.status === "failed" ? t("balance.failed") : t("balance.cancelled"),
          })
        );
        setPaymentStatus("failed");

        // Close the modal after showing the message
        setTimeout(() => {
          handleClose();
        }, 2000); // Close after 2 seconds
      } else {
        // Unknown status
        message.warning(t("balance.paymentStatusUnknown", { status: payment.status }));
        setPaymentStatus("pending");

        // Close the modal after showing the message
        setTimeout(() => {
          handleClose();
        }, 2000); // Close after 2 seconds
      }
    } catch (error: any) {
      console.error("Payment status check failed:", error);
      message.error(error.message || t("balance.cannotCheckPaymentStatus"));
      setPaymentStatus("pending");
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
          {t("balance.accountRecharge")}
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
        <Title level={3}>{t("balance.selectRechargeAmount")}</Title>
        <Text type="secondary">
          {t("balance.currentBalance")}: ${currentBalance.toFixed(2)}
        </Text>
      </div>

      <Form layout="vertical">
        <Form.Item label={t("balance.selectAmount")} required>
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
            <Text strong>{t("balance.customAmount")}:</Text>
            <Input
              placeholder={t("balance.enterRechargeAmount")}
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
                {t("balance.createPaymentOrder", { amount: selectedAmount.toFixed(2) })}
              </Button>
            )}

            {paymentStatus === "created" && (
              <div style={{ marginBottom: "16px" }}>
                <Text type="success" strong>
                  ✅ {t("balance.paymentOrderCreatedPleasePay")}
                </Text>
              </div>
            )}

            {paymentStatus === "pending" && (
              <div style={{ marginBottom: "16px" }}>
                <Text type="warning" strong>
                  ⏳ {t("balance.paymentNotCompleted")}
                </Text>
              </div>
            )}

            {paymentStatus === "failed" && (
              <div style={{ marginBottom: "16px" }}>
                <Text type="danger" strong>
                  ❌ {t("balance.paymentFailedOrCancelledRetry")}
                </Text>
              </div>
            )}

            {paymentStatus === "confirmed" && (
              <div style={{ marginBottom: "16px" }}>
                <Text type="success" strong>
                  🎉 {t("balance.paymentConfirmedProcessing")}
                </Text>
              </div>
            )}
          </div>
        )}

        {paymentUrl && (
          <>
            <div style={{ marginBottom: "16px" }}>
              <Text strong>{t("balance.paymentLink")}:</Text>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <Input value={paymentUrl} readOnly style={{ flex: 1 }} />
                <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(paymentUrl)}>
                  {t("balance.copy")}
                </Button>
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={() => window.open(paymentUrl, "_blank")}
                >
                  {t("balance.open")}
                </Button>
              </div>
            </div>

            {/* {qrCode && (
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
            )} */}

            <div style={{ textAlign: "center" }}>
              <Button
                type="primary"
                size="large"
                loading={loading}
                icon={<CheckCircleOutlined />}
                onClick={handlePaymentSuccess}
                style={{ minWidth: "200px" }}
              >
                {t("balance.checkPaymentStatus")}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default AddFundsModal;
