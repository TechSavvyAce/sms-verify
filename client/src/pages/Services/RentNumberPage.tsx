import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Button,
  Row,
  Col,
  Modal,
  Steps,
  Space,
  Divider,
  Tag,
  Progress,
  Alert,
  message,
  InputNumber,
  Input,
  Spin,
  Select,
} from "antd";
import { PhoneOutlined, ArrowRightOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate } from "react-router-dom";
import { rentalApi } from "../../services/api";
import countriesData from "../../data/countries.json";
import { getApiErrorMessage } from "../../utils/errorHelpers";

const { Title, Paragraph, Text } = Typography;

const RentNumberPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [customDuration, setCustomDuration] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [visibleCountries, setVisibleCountries] = useState<number>(20);
  const [serviceSearch, setServiceSearch] = useState<string>("");
  const [services, setServices] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  // Duration options for rental
  const durationOptions = [
    { value: 1, label: "1 Hour", label_cn: "1小时", price_multiplier: 1 },
    { value: 4, label: "4 Hours", label_cn: "4小时", price_multiplier: 1.5 },
    { value: 12, label: "12 Hours", label_cn: "12小时", price_multiplier: 2 },
    { value: 24, label: "1 Day", label_cn: "1天", price_multiplier: 3 },
    { value: 48, label: "2 Days", label_cn: "2天", price_multiplier: 5 },
    { value: 72, label: "3 Days", label_cn: "3天", price_multiplier: 7 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        const servicesRes = await rentalApi.getServices();

        if (servicesRes.success && servicesRes.data) {
          // Transform the API response to match our expected format
          const apiData = servicesRes.data;

          // Transform services
          const transformedServices = Object.entries(apiData.services || {}).map(
            ([code, data]: [string, any]) => ({
              code: code || "",
              name: code || "",
              name_cn: code || "",
              description: `Service for ${code}`,
              description_cn: `${code} 服务`,
              base_price: parseFloat(data?.cost) || 5.0,
              success_rate: 95,
              available: parseInt(data?.quant) || 20,
            })
          );

          // Transform countries
          const transformedCountries = Object.entries(apiData.countries || {})
            .map(([id, multiplier]: [string, any]) => {
              const countryId = parseInt(id) || 0;
              // Find the country data from our countries.json file
              const countryInfo = countriesData.find((c) => c.id === countryId);

              return {
                id: countryId,
                name_en: countryInfo?.name_en || `Country ${id}`,
                name_cn: countryInfo?.name_cn || `国家 ${id}`,
                flag:
                  countryInfo?.flag || `https://flagcdn.com/w20/${id?.toLowerCase() || "0"}.png`,
                price_multiplier: parseFloat(multiplier) || 1.0,
                region: countryInfo?.region || "Unknown",
                timezone: countryInfo?.timezone || "Unknown",
                available: countryInfo?.available || true,
                popularity: countryInfo?.popularity || "medium",
              };
            })
            .filter((country) => country.available) // Only show available countries
            .sort((a, b) => {
              // Sort by popularity: high > medium > low
              const popularityOrder = { high: 3, medium: 2, low: 1 };
              return (
                (popularityOrder[b.popularity as keyof typeof popularityOrder] || 0) -
                (popularityOrder[a.popularity as keyof typeof popularityOrder] || 0)
              );
            });

          setServices(transformedServices);
          setCountries(transformedCountries);
        }
      } catch (error: any) {
        message.error("获取服务数据失败");
        console.error("Error fetching services:", error);
        // Set default empty arrays to prevent crashes
        setServices([]);
        setCountries([]);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // 计算最终价格
  const getFinalPrice = () => {
    if (!selectedService) return 0;

    const country = countries.find((c) => c.id === selectedCountry);
    if (!country) return selectedService.base_price;

    return (
      selectedService.base_price *
      (selectedDuration > 72
        ? 7
        : selectedDuration > 48
          ? 5
          : selectedDuration > 24
            ? 3
            : selectedDuration > 12
              ? 2
              : selectedDuration > 6
                ? 1.5
                : 1) *
      (country.price_multiplier || 1)
    );
  };

  // 检查余额是否足够
  const hasEnoughBalance = () => {
    const finalPrice = parseFloat(getFinalPrice());
    return user && user.balance >= finalPrice;
  };

  // 处理服务选择
  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setCurrentStep(1);
  };

  // 处理时长选择
  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setCustomDuration(duration);
    setCurrentStep(2);
  };

  // 处理国家选择
  const handleCountrySelect = (countryId: number) => {
    setSelectedCountry(countryId);
    setCurrentStep(3);
  };

  // 确认租用
  const handleConfirmRental = async () => {
    if (!hasEnoughBalance()) {
      message.error("余额不足，请先充值");
      return;
    }

    if (!selectedService || !selectedCountry || !selectedDuration) {
      message.error("请完成所有选择");
      return;
    }

    setLoading(true);
    try {
      const response = await rentalApi.create({
        service: selectedService.code,
        time: selectedDuration,
        country: selectedCountry,
        operator: "any",
      });

      if (response.success) {
        message.success("租用订单创建成功！");
        setModalVisible(false);
        setCurrentStep(0);
        setSelectedService(null);
        setSelectedDuration(1);
        setSelectedCountry(null);
        setCountrySearch("");
        setVisibleCountries(20);
        setServiceSearch("");

        // 跳转到租用记录页面
        navigate("/rentals");
      } else {
        throw new Error("租用失败");
      }
    } catch (error: any) {
      console.error("租用失败:", error);
      message.error(getApiErrorMessage(error.response?.data?.error, "租用订单创建失败，请重试"));
    } finally {
      setLoading(false);
    }
  };

  // 重置选择
  const handleReset = () => {
    setCurrentStep(0);
    setSelectedService(null);
    setSelectedDuration(1);
    setSelectedCountry(null);
    setCustomDuration(1);
    setCountrySearch("");
    setVisibleCountries(20);
    setServiceSearch("");
    setSelectedRegion("all");
  };

  // 过滤国家列表
  const filteredCountries = countries.filter((country) => {
    const matchesSearch =
      country.name_cn.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.name_en.toLowerCase().includes(countrySearch.toLowerCase());
    const matchesRegion = selectedRegion === "all" || country.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  // 显示更多国家
  const handleShowMore = () => {
    setVisibleCountries((prev) => prev + 20);
  };

  // 重置国家显示数量
  const resetCountryDisplay = () => {
    setVisibleCountries(20);
  };

  // 过滤服务列表
  const filteredServices = services.filter(
    (service) =>
      service.name_cn?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      service.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      service.description_cn?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      service.description?.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  // 步骤配置
  const steps = [
    { title: "选择服务", description: "选择租用服务类型" },
    { title: "选择时长", description: "选择租用时长" },
    { title: "选择国家", description: "选择号码所属国家" },
    { title: "确认租用", description: "确认租用信息并支付" },
  ];

  return (
    <div>
      <Card>
        <Row align="middle" justify="center" style={{ minHeight: "400px" }}>
          <Col span={24} style={{ textAlign: "center" }}>
            <PhoneOutlined
              style={{
                fontSize: "64px",
                color: "#722ed1",
                marginBottom: "24px",
              }}
            />
            <Title level={2}>号码租用服务</Title>
            <Paragraph
              style={{
                fontSize: "16px",
                maxWidth: "600px",
                margin: "0 auto 32px",
              }}
            >
              租用手机号码一段时间，接收多条短信。适合需要持续验证或多次注册的场景。
              灵活的租用时长，实时短信接收，安全可靠。
            </Paragraph>

            {/* 余额显示 */}
            <div style={{ marginBottom: "24px" }}>
              <Text type="secondary">当前余额: </Text>
              <Text strong style={{ fontSize: "18px", color: "#722ed1" }}>
                ${user?.balance?.toFixed(2) || "0.00"}
              </Text>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={() => setModalVisible(true)}
              style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
              disabled={dataLoading}
            >
              {dataLoading ? "加载中..." : "开始租用号码"}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 租用服务选择模态框 */}
      <Modal
        title="选择租用服务"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Spin spinning={dataLoading} tip="加载服务信息中...">
          {/* 步骤条 */}
          <Steps current={currentStep} style={{ marginBottom: "32px" }}>
            {steps.map((step, index) => (
              <Steps.Step key={index} title={step.title} description={step.description} />
            ))}
          </Steps>

          {/* 步骤内容 */}
          {currentStep === 0 && (
            <div>
              <Title level={4}>选择租用服务类型</Title>

              {/* 服务搜索 */}
              <div style={{ marginBottom: "24px" }}>
                <Input
                  placeholder="搜索服务名称或描述（支持中文和英文）"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  style={{ maxWidth: "500px" }}
                  allowClear
                  size="large"
                />
              </div>

              {serviceSearch ? (
                // 搜索结果
                <div>
                  <div style={{ marginBottom: "16px" }}>
                    <Text type="secondary">找到 {filteredServices?.length || 0} 个相关服务</Text>
                  </div>
                  <Row gutter={[16, 16]}>
                    {filteredServices?.map((service) => (
                      <Col xs={24} sm={12} lg={8} key={service.code}>
                        <Card
                          hoverable
                          style={{ cursor: "pointer" }}
                          onClick={() => handleServiceSelect(service)}
                        >
                          <div
                            style={{
                              textAlign: "center",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ marginBottom: "8px" }}>
                              <img
                                src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${service.code}0.webp`}
                                alt={`${service.name_cn || service.name} icon`}
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  marginBottom: "8px",
                                  borderRadius: "4px",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            </div>
                            <Title level={4} style={{ margin: 0 }}>
                              {service.name_cn || service.name || "Unknown Service"}
                            </Title>
                          </div>

                          <Paragraph style={{ marginBottom: "16px" }}>
                            {service.description_cn ||
                              service.description ||
                              "No description available"}
                          </Paragraph>

                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <Text type="secondary">成功率:</Text>
                              <Text strong>{service.success_rate || 0}%</Text>
                            </div>
                            <Progress
                              percent={service.success_rate || 0}
                              size="small"
                              showInfo={false}
                              strokeColor={
                                (service.success_rate || 0) >= 98
                                  ? "#52c41a"
                                  : (service.success_rate || 0) >= 95
                                    ? "#faad14"
                                    : "#ff4d4f"
                              }
                            />
                          </div>

                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text type="secondary">基础价格:</Text>
                              <Tag color="blue">${(service.base_price || 0).toFixed(2)}/小时</Tag>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text type="secondary">可用数量:</Text>
                              <Text>{service.available || 0}</Text>
                            </div>
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              ) : (
                // 显示所有服务
                <div>
                  <div style={{ marginBottom: "16px" }}>
                    <Text type="secondary">共 {services?.length || 0} 个租用服务</Text>
                  </div>
                  <Row gutter={[16, 16]}>
                    {services?.map((service) => (
                      <Col xs={24} sm={12} lg={8} key={service.code}>
                        <Card
                          hoverable
                          style={{ cursor: "pointer" }}
                          onClick={() => handleServiceSelect(service)}
                        >
                          <div
                            style={{
                              textAlign: "center",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ marginBottom: "8px" }}>
                              <img
                                src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${service.code}0.webp`}
                                alt={`${service.name_cn || service.name} icon`}
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  marginBottom: "8px",
                                  borderRadius: "4px",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            </div>
                            <Title level={4} style={{ margin: 0 }}>
                              {service.name_cn || service.name || "Unknown Service"}
                            </Title>
                          </div>

                          <Paragraph style={{ marginBottom: "16px" }}>
                            {service.description_cn ||
                              service.description ||
                              "No description available"}
                          </Paragraph>

                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <Text type="secondary">成功率:</Text>
                              <Text strong>{service.success_rate || 0}%</Text>
                            </div>
                            <Progress
                              percent={service.success_rate || 0}
                              size="small"
                              showInfo={false}
                              strokeColor={
                                (service.success_rate || 0) >= 98
                                  ? "#52c41a"
                                  : (service.success_rate || 0) >= 95
                                    ? "#faad14"
                                    : "#ff4d4f"
                              }
                            />
                          </div>

                          <div style={{ marginBottom: "16px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text type="secondary">基础价格:</Text>
                              <Tag color="blue">${(service.base_price || 0).toFixed(2)}/小时</Tag>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text type="secondary">可用数量:</Text>
                              <Text>{service.available || 0}</Text>
                            </div>
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <Title level={4}>选择租用时长</Title>
              <Paragraph>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <img
                    src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${selectedService?.code}0.webp`}
                    alt={`${selectedService?.name_cn || selectedService?.name} icon`}
                    style={{
                      width: "32px",
                      height: "32px",
                      marginRight: "12px",
                      borderRadius: "6px",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                  <Text strong>
                    已选择服务:{" "}
                    {selectedService?.name_cn || selectedService?.name || "Unknown Service"}
                  </Text>
                </div>
                基础价格:{" "}
                <Text strong style={{ color: "#722ed1" }}>
                  ${(selectedService?.base_price || 0).toFixed(2)}/小时
                </Text>
              </Paragraph>

              <Row gutter={[16, 16]}>
                {durationOptions.map((duration) => (
                  <Col xs={24} sm={12} lg={8} key={duration.value}>
                    <Card
                      hoverable
                      style={{
                        cursor: "pointer",
                        border:
                          selectedDuration === duration.value ? "2px solid #722ed1" : undefined,
                      }}
                      onClick={() => handleDurationSelect(duration.value)}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                          <ClockCircleOutlined />
                        </div>
                        <Title level={4} style={{ margin: 0 }}>
                          {duration.label_cn || duration.label}
                        </Title>
                        <div style={{ marginTop: "8px" }}>
                          <Text type="secondary">价格系数: </Text>
                          <Tag color="purple">{duration.price_multiplier}x</Tag>
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <Text strong style={{ color: "#722ed1", fontSize: "16px" }}>
                            ${(selectedService?.base_price * duration.price_multiplier).toFixed(2)}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              <Divider />

              <div>
                <Title level={5}>自定义时长</Title>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <InputNumber
                    min={1}
                    max={168} // 7天
                    value={customDuration}
                    onChange={(value) => setCustomDuration(value || 1)}
                    addonAfter="小时"
                    style={{ width: "120px" }}
                  />
                  <Text type="secondary">
                    价格: $
                    {(
                      selectedService?.base_price *
                      (customDuration > 72
                        ? 7
                        : customDuration > 48
                          ? 5
                          : customDuration > 24
                            ? 3
                            : customDuration > 12
                              ? 2
                              : customDuration > 6
                                ? 1.5
                                : 1)
                    ).toFixed(2)}
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  自定义时长价格按阶梯计算，超过72小时按7倍计算
                </Text>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <Title level={4}>选择国家地区</Title>
              <Paragraph>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <img
                    src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${selectedService?.code}0.webp`}
                    alt={`${selectedService?.name_cn || selectedService?.name} icon`}
                    style={{
                      width: "32px",
                      height: "32px",
                      marginRight: "12px",
                      borderRadius: "6px",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                  <Text strong>
                    已选择服务:{" "}
                    {selectedService?.name_cn || selectedService?.name || "Unknown Service"}
                  </Text>
                </div>
                已选择时长: <Text strong>{selectedDuration} 小时</Text>
                <br />
                基础价格:{" "}
                <Text strong style={{ color: "#722ed1" }}>
                  $
                  {(
                    (selectedService?.base_price || 0) *
                    (selectedDuration > 72
                      ? 7
                      : selectedDuration > 48
                        ? 5
                        : selectedDuration > 24
                          ? 3
                          : selectedDuration > 12
                            ? 2
                            : selectedDuration > 6
                              ? 1.5
                              : 1)
                  ).toFixed(2)}
                </Text>
              </Paragraph>

              {/* 国家搜索 */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
                  <Select
                    placeholder="选择地区"
                    value={selectedRegion}
                    onChange={setSelectedRegion}
                    style={{ width: "150px" }}
                    allowClear
                  >
                    <Select.Option value="all">所有地区</Select.Option>
                    <Select.Option value="Europe">欧洲</Select.Option>
                    <Select.Option value="Asia">亚洲</Select.Option>
                    <Select.Option value="Africa">非洲</Select.Option>
                    <Select.Option value="Americas">美洲</Select.Option>
                    <Select.Option value="Oceania">大洋洲</Select.Option>
                  </Select>
                  <Input
                    placeholder="搜索国家名称（支持中文和英文）"
                    value={countrySearch}
                    onChange={(e) => {
                      setCountrySearch(e.target.value);
                      resetCountryDisplay();
                    }}
                    style={{ flex: 1, maxWidth: "400px" }}
                    allowClear
                  />
                </div>
              </div>

              <Row gutter={[16, 16]}>
                {filteredCountries?.slice(0, visibleCountries).map((country) => (
                  <Col xs={24} sm={12} lg={8} key={country.id}>
                    <Card
                      hoverable
                      style={{
                        cursor: "pointer",
                        border: selectedCountry === country.id ? "2px solid #722ed1" : undefined,
                      }}
                      onClick={() => handleCountrySelect(country.id)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <img
                            src={country.flag}
                            alt={`${country.name_cn} flag`}
                            style={{
                              width: "24px",
                              height: "18px",
                              marginRight: "8px",
                              borderRadius: "2px",
                            }}
                          />
                          <div>
                            <Text strong>{country.name_cn}</Text>
                            <br />
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <Tag color="blue">{country.region}</Tag>
                              <Text type="secondary" style={{ fontSize: "12px" }}>
                                {country.timezone}
                              </Text>
                            </div>
                          </div>
                        </div>
                        <Tag color="green">
                          $
                          {(
                            (selectedService?.base_price || 0) *
                            (selectedDuration > 72
                              ? 7
                              : selectedDuration > 48
                                ? 5
                                : selectedDuration > 24
                                  ? 3
                                  : selectedDuration > 12
                                    ? 2
                                    : selectedDuration > 6
                                      ? 1.5
                                      : 1) *
                            country.price_multiplier
                          ).toFixed(2)}
                        </Tag>
                      </div>

                      {country.price_multiplier !== 1.0 && (
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          价格系数: {country.price_multiplier}x
                        </Text>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* 显示更多按钮 */}
              {filteredCountries.length > visibleCountries && (
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                  <Button
                    type="primary"
                    onClick={handleShowMore}
                    style={{
                      backgroundColor: "#722ed1",
                      borderColor: "#722ed1",
                    }}
                  >
                    显示更多 (还有 {filteredCountries.length - visibleCountries} 个国家)
                  </Button>
                </div>
              )}

              {/* 搜索结果统计 */}
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Text type="secondary">
                  {countrySearch
                    ? `找到 ${filteredCountries?.length || 0} 个国家`
                    : `共 ${countries?.length || 0} 个国家，显示 ${Math.min(
                        visibleCountries,
                        filteredCountries?.length || 0
                      )} 个`}
                </Text>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <Title level={4}>确认租用信息</Title>

              <Card style={{ marginBottom: "24px" }}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text strong>选择的服务:</Text>
                    <br />
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <img
                        src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${selectedService?.code}0.webp`}
                        alt={`${
                          selectedService?.name_cn || selectedService?.name || "Unknown Service"
                        } icon`}
                        style={{
                          width: "20px",
                          height: "20px",
                          marginRight: "8px",
                          borderRadius: "4px",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <Text>
                        {selectedService?.name_cn || selectedService?.name || "Unknown Service"}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text strong>租用时长:</Text>
                    <br />
                    <Text>{selectedDuration} 小时</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>选择的国家:</Text>
                    <br />
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <img
                        src={countries.find((c) => c.id === selectedCountry)?.flag}
                        alt={`${
                          countries.find((c) => c.id === selectedCountry)?.name_cn ||
                          "Unknown Country"
                        } flag`}
                        style={{
                          width: "20px",
                          height: "15px",
                          marginRight: "8px",
                          borderRadius: "2px",
                        }}
                      />
                      <Text>
                        {countries.find((c) => c.id === selectedCountry)?.name_cn ||
                          "Unknown Country"}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text strong>最终价格:</Text>
                    <br />
                    <Text strong style={{ fontSize: "18px", color: "#722ed1" }}>
                      ${getFinalPrice()}
                    </Text>
                  </Col>
                </Row>
              </Card>

              {/* 余额检查 */}
              {!hasEnoughBalance() && (
                <Alert
                  message="余额不足"
                  description={`当前余额 $${
                    user?.balance?.toFixed(2) || "0.00"
                  }，需要 $${getFinalPrice()}`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: "24px" }}
                  action={
                    <Button size="small" onClick={() => navigate("/profile?tab=balance")}>
                      立即充值
                    </Button>
                  }
                />
              )}

              {/* 服务说明 */}
              <Alert
                message="租用说明"
                description={`租用期间，您将获得一个专属手机号码，可以接收多条短信。租用时长结束后，号码将被自动回收。如需延长租用时间，请在到期前续费。`}
                type="info"
                showIcon
                style={{ marginBottom: "24px" }}
              />

              {/* 费用明细 */}
              <Card title="费用明细" size="small">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text>基础价格:</Text>
                  <Text>${(selectedService?.base_price || 0).toFixed(2)}/小时</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text>时长系数:</Text>
                  <Text>
                    {selectedDuration > 72
                      ? "7x"
                      : selectedDuration > 48
                        ? "5x"
                        : selectedDuration > 24
                          ? "3x"
                          : selectedDuration > 12
                            ? "2x"
                            : selectedDuration > 6
                              ? "1.5x"
                              : "1x"}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text>国家系数:</Text>
                  <Text>
                    {countries.find((c) => c.id === selectedCountry)?.price_multiplier || 1}x
                  </Text>
                </div>
                <Divider style={{ margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text strong>总计:</Text>
                  <Text strong style={{ color: "#722ed1" }}>
                    ${getFinalPrice()}
                  </Text>
                </div>
              </Card>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <Space size="middle">
              {currentStep > 0 && (
                <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
              )}

              {currentStep < 3 && (
                <Button
                  type="primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={
                    (currentStep === 0 && !selectedService) ||
                    (currentStep === 1 && !selectedDuration) ||
                    (currentStep === 2 && !selectedCountry)
                  }
                  style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
                >
                  下一步
                </Button>
              )}

              {currentStep === 3 && (
                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  onClick={handleConfirmRental}
                  disabled={!hasEnoughBalance()}
                  style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
                >
                  确认租用 (${getFinalPrice()})
                </Button>
              )}

              <Button onClick={handleReset}>重新选择</Button>
            </Space>
          </div>
        </Spin>
      </Modal>
    </div>
  );
};

export default RentNumberPage;
