import React, { useState } from "react";
import { Modal, Form, Input, Button, message, Typography, Alert } from "antd";
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import { authApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";

const { Text } = Typography;

interface SetPasswordModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  username: string;
}

const SetPasswordModal: React.FC<SetPasswordModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  username,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong">("weak");

  const checkPasswordStrength = (password: string) => {
    if (password.length < 6) return "weak";
    if (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    ) {
      return "strong";
    }
    return "medium";
  };

  const getPasswordStrengthColor = (strength: string) => {
    switch (strength) {
      case "strong":
        return "#52c41a";
      case "medium":
        return "#faad14";
      case "weak":
        return "#ff4d4f";
      default:
        return "#d9d9d9";
    }
  };

  const getPasswordStrengthText = (strength: string) => {
    switch (strength) {
      case "strong":
        return "强";
      case "medium":
        return "中";
      case "weak":
        return "弱";
      default:
        return "";
    }
  };

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.setPassword(username, values.password);

      if (response.success) {
        message.success("密码设置成功！");
        form.resetFields();
        onSuccess();
      } else {
        message.error(getApiErrorMessage(response.error, "密码设置失败"));
      }
    } catch (error: any) {
      message.error(getApiErrorMessage(error.response?.data?.error, "密码设置失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center" }}>
          <LockOutlined style={{ marginRight: "8px", color: "#1890ff" }} />
          设置账户密码
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={500}
      destroyOnClose
    >
      <div style={{ marginBottom: "16px" }}>
        <Alert
          message="账户安全建议"
          description="设置密码后，您可以使用用户名+密码快速登录，无需等待验证码。"
          type="info"
          showIcon
        />
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="password"
          label="新密码"
          rules={[
            { required: true, message: "请输入密码" },
            { min: 6, message: "密码长度至少为6个字符" },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
              message: "密码应包含大小写字母和数字",
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#1890ff" }} />}
            placeholder="请输入新密码"
            size="large"
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            onChange={(e) => setPasswordStrength(checkPasswordStrength(e.target.value))}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="确认密码"
          rules={[
            { required: true, message: "请确认密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("两次输入的密码不一致"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#1890ff" }} />}
            placeholder="请再次输入新密码"
            size="large"
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          />
        </Form.Item>

        <div style={{ marginBottom: "16px" }}>
          <Text type="secondary">密码强度：</Text>
          <Text
            style={{
              color: getPasswordStrengthColor(passwordStrength),
              fontWeight: "bold",
              marginLeft: "8px",
            }}
          >
            {getPasswordStrengthText(passwordStrength)}
          </Text>
        </div>

        <Form.Item>
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <Button onClick={handleCancel} size="large">
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              icon={<LockOutlined />}
            >
              设置密码
            </Button>
          </div>
        </Form.Item>
      </Form>

      <div
        style={{ marginTop: "16px", padding: "12px", background: "#f9f9f9", borderRadius: "6px" }}
      >
        <Text type="secondary" style={{ fontSize: "12px" }}>
          <strong>密码要求：</strong>
          <br />
          • 至少6个字符
          <br />
          • 包含大小写字母和数字
          <br />
          • 避免使用常见密码
          <br />• 建议定期更换密码
        </Text>
      </div>
    </Modal>
  );
};

export default SetPasswordModal;
