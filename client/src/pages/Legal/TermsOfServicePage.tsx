import React, { useState } from "react";
import {
  Card,
  Typography,
  Button,
  Space,
  Affix,
  Anchor,
  Row,
  Col,
  Divider,
  Tag,
  FloatButton,
} from "antd";
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  SafetyOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  PhoneOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import "./LegalPages.css";

const { Title, Paragraph, Text } = Typography;
const { Link } = Anchor;

const TermsOfServicePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useLocalizedNavigate();

  const sections = [
    { key: "acceptance", icon: <UserOutlined />, color: "#52c41a" },
    { key: "serviceDescription", icon: <FileTextOutlined />, color: "#1890ff" },
    { key: "userAccount", icon: <UserOutlined />, color: "#722ed1" },
    { key: "acceptableUse", icon: <SafetyOutlined />, color: "#fa8c16" },
    { key: "payment", icon: <DollarOutlined />, color: "#13c2c2" },
    { key: "privacy", icon: <InfoCircleOutlined />, color: "#eb2f96" },
    { key: "disclaimer", icon: <ExclamationCircleOutlined />, color: "#f5222d" },
    { key: "limitation", icon: <ExclamationCircleOutlined />, color: "#fa541c" },
    { key: "termination", icon: <ExclamationCircleOutlined />, color: "#a0d911" },
    { key: "changes", icon: <CalendarOutlined />, color: "#2f54eb" },
    { key: "contact", icon: <PhoneOutlined />, color: "#52c41a" },
  ];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <Card
          style={{
            marginBottom: "24px",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            border: "none",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Space style={{ marginBottom: "20px" }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => window.history.back()}
              type="text"
              size="large"
              style={{
                color: "#1890ff",
                fontSize: "16px",
                fontWeight: "500",
              }}
            >
              {t("common.back")}
            </Button>
          </Space>

          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                marginBottom: "20px",
                boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)",
              }}
            >
              <FileTextOutlined style={{ fontSize: "32px", color: "white" }} />
            </div>
            <Title
              level={1}
              style={{
                margin: 0,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontSize: "2.5rem",
                fontWeight: "700",
              }}
            >
              {t("legal.termsOfService.title")}
            </Title>
            <Tag
              icon={<CalendarOutlined />}
              color="blue"
              style={{
                fontSize: "14px",
                padding: "8px 16px",
                borderRadius: "20px",
                marginTop: "12px",
              }}
            >
              {t("legalPages.lastUpdated")}: {t("legal.termsOfService.lastUpdated")}
            </Tag>
          </div>
        </Card>

        <Row gutter={[32, 32]}>
          {/* Table of Contents */}
          <Col xs={24} lg={5}>
            <div
              style={{
                position: "sticky",
                top: "120px",
                display: "block",
              }}
              className="toc-container"
            >
              <Card
                title={
                  <Space>
                    <FileTextOutlined />
                    <span style={{ fontSize: "16px", fontWeight: "600" }}>
                      {t("legalPages.tableOfContents")}
                    </span>
                  </Space>
                }
                style={{
                  borderRadius: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  border: "1px solid #f0f0f0",
                }}
                bodyStyle={{ padding: "16px" }}
              >
                <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                  <Anchor
                    affix={false}
                    showInkInFixed={true}
                    items={sections.map((section) => ({
                      key: section.key,
                      href: `#${section.key}`,
                      title: (
                        <div
                          style={{
                            fontSize: "13px",
                            lineHeight: "1.4",
                            padding: "4px 0",
                            color: "#666",
                          }}
                        >
                          {t(`legal.termsOfService.${section.key}.title`)}
                        </div>
                      ),
                    }))}
                  />
                </div>
              </Card>
            </div>
          </Col>

          {/* Main Content */}
          <Col xs={24} lg={19}>
            <Card
              style={{
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                border: "none",
              }}
            >
              {sections.map((section, index) => (
                <div
                  key={section.key}
                  id={section.key}
                  className="legal-section"
                  style={{ marginBottom: "40px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "20px",
                      padding: "16px",
                      background: `linear-gradient(135deg, ${section.color}15 0%, ${section.color}05 100%)`,
                      borderRadius: "12px",
                      border: `1px solid ${section.color}30`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: section.color,
                        marginRight: "16px",
                        boxShadow: `0 4px 16px ${section.color}40`,
                      }}
                    >
                      {React.cloneElement(section.icon, {
                        style: { fontSize: "20px", color: "white" },
                      })}
                    </div>
                    <Title
                      level={2}
                      style={{
                        margin: 0,
                        color: section.color,
                        fontSize: "1.5rem",
                      }}
                    >
                      {t(`legal.termsOfService.${section.key}.title`)}
                    </Title>
                  </div>

                  <Paragraph
                    style={{
                      fontSize: "16px",
                      lineHeight: "1.8",
                      color: "#333",
                      marginBottom: "24px",
                    }}
                  >
                    {t(`legal.termsOfService.${section.key}.content`)}
                  </Paragraph>

                  {index < sections.length - 1 && <Divider style={{ margin: "32px 0" }} />}
                </div>
              ))}

              {/* Footer Actions */}
              <div
                style={{
                  textAlign: "center",
                  marginTop: "48px",
                  padding: "32px",
                  background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                  borderRadius: "12px",
                }}
              >
                <Space size="large" direction="vertical" style={{ width: "100%" }}>
                  <Space size="large" wrap style={{ width: "100%", justifyContent: "center" }}>
                    <Button
                      type="primary"
                      size="large"
                      onClick={() => navigate("/login")}
                      style={{
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        border: "none",
                        borderRadius: "8px",
                        height: "48px",
                        padding: "0 32px",
                        fontSize: "16px",
                        fontWeight: "600",
                        boxShadow: "0 4px 16px rgba(102, 126, 234, 0.3)",
                        minWidth: "140px",
                      }}
                    >
                      <ArrowLeftOutlined />
                      {t("common.back")}
                    </Button>
                  </Space>
                  <Space size="large" wrap style={{ width: "100%", justifyContent: "center" }}>
                    <Button
                      size="large"
                      onClick={() => navigate("privacy")}
                      style={{
                        borderRadius: "8px",
                        height: "48px",
                        padding: "0 32px",
                        fontSize: "16px",
                        fontWeight: "600",
                        minWidth: "140px",
                      }}
                    >
                      {t("legalPages.viewPrivacyPolicy")}
                    </Button>
                  </Space>
                </Space>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Back to Top Button */}
        <FloatButton
          icon={<VerticalAlignTopOutlined />}
          tooltip={t("legalPages.backToTop")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            right: 24,
            bottom: 24,
          }}
        />
      </div>
    </div>
  );
};

export default TermsOfServicePage;
