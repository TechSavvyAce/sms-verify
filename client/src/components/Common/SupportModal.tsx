import React, { useState } from 'react';
import { Modal, Button, Card, Row, Col, Typography, Space, Avatar, Tag, Divider } from 'antd';
import { MessageOutlined, UserOutlined, ClockCircleOutlined, GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface SupportOption {
  id: string;
  name: string;
  username: string;
  url: string;
  description: string;
  availability: string;
  language: string;
  avatar?: string;
  isOnline?: boolean;
}

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

const SupportModal: React.FC<SupportModalProps> = ({ visible, onClose, isMobile = false }) => {
  const [selectedSupport, setSelectedSupport] = useState<SupportOption | null>(null);
  const { t } = useTranslation();

  const supportOptions: SupportOption[] = [
    {
      id: 'primary',
      name: t('support.primarySupport'),
      username: 'lufeng1868',
      url: 'https://t.me/lufeng1868',
      description: t('support.primarySupportDescription'),
      availability: t('support.availability24_7'),
      language: t('support.languageSupport'),
      isOnline: true
    },
    {
      id: 'secondary',
      name: t('support.technicalSupport'),
      username: 'smsyz_support',
      url: 'https://t.me/smsyz_support',
      description: t('support.technicalSupportDescription'),
      availability: t('support.businessHours'),
      language: t('support.languageSupport'),
      isOnline: true
    }
  ];

  const handleSupportClick = (support: SupportOption) => {
    setSelectedSupport(support);
    // Open Telegram in new tab
    window.open(support.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const getAvailabilityColor = (availability: string) => {
    if (availability === t('support.availability24_7')) {
      return 'green';
    } else if (availability === t('support.businessHours')) {
      return 'blue';
    }
    return 'default';
  };

  const getLanguageColor = (language: string) => {
    if (language.includes('English') && language.includes('中文')) {
      return 'purple';
    }
    return 'default';
  };

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined />
          <span>{t('support.contactSupport')}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '95%' : 800}
      centered
      style={{ top: isMobile ? 20 : 50 }}
    >
      <div style={{ padding: '16px 0' }}>
        <Paragraph style={{ textAlign: 'center', marginBottom: 24, fontSize: 16 }}>
          {t('support.chooseSupportChannel')}
        </Paragraph>

        <Row gutter={[16, 16]}>
          {supportOptions.map((support) => (
            <Col xs={24} sm={12} key={support.id}>
              <Card
                hoverable
                style={{
                  height: '100%',
                  border: selectedSupport?.id === support.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  borderRadius: 12,
                  transition: 'all 0.3s ease'
                }}
                bodyStyle={{ padding: 20 }}
                onClick={() => handleSupportClick(support)}
              >
                <div style={{ textAlign: 'center' }}>
                  <Avatar
                    size={64}
                    icon={<UserOutlined />}
                    style={{
                      backgroundColor: support.id === 'primary' ? '#1890ff' : '#52c41a',
                      marginBottom: 16
                    }}
                  />
                  
                  <Title level={4} style={{ marginBottom: 8, color: '#262626' }}>
                    {support.name}
                  </Title>
                  
                  <Text code style={{ fontSize: 14, marginBottom: 12, display: 'block' }}>
                    @{support.username}
                  </Text>

                  <Paragraph
                    style={{
                      fontSize: 13,
                      color: '#666',
                      marginBottom: 16,
                      minHeight: 40,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {support.description}
                  </Paragraph>

                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space size="small">
                      <ClockCircleOutlined style={{ color: '#1890ff' }} />
                      <Tag color={getAvailabilityColor(support.availability)}>
                        {support.availability}
                      </Tag>
                    </Space>
                    
                    <Space size="small">
                      <GlobalOutlined style={{ color: '#52c41a' }} />
                      <Tag color={getLanguageColor(support.language)}>
                        {support.language}
                      </Tag>
                    </Space>

                    {support.isOnline && (
                      <Tag color="green" style={{ marginTop: 8 }}>
                        {t('support.onlineNow')}
                      </Tag>
                    )}
                  </Space>

                  <Button
                    type="primary"
                    size="large"
                    icon={<MessageOutlined />}
                    style={{
                      marginTop: 16,
                      width: '100%',
                      borderRadius: 8,
                      height: 40
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSupportClick(support);
                    }}
                  >
{t('support.contactOnTelegram')}
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Divider style={{ margin: '24px 0 16px 0' }} />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('support.supportTip')}
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default SupportModal;
