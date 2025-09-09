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
import { rentalApi } from "../../services/api";
import countriesData from "../../data/countries.json";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";

const { Title, Paragraph, Text } = Typography;

const RentNumberPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const navigate = useLocalizedNavigate();
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

  // 根据当前语言获取本地化名称
  const getLocalizedName = (item: any) => {
    if (currentLanguage === "zh-CN") {
      return item.name_cn || item.name;
    } else {
      return item.name || item.name_cn;
    }
  };

  // Duration options for rental
  const durationOptions = [
    { value: 1, label: t("rentals.oneHour"), price_multiplier: 1 },
    { value: 4, label: t("rentals.fourHours"), price_multiplier: 1.5 },
    { value: 12, label: t("rentals.twelveHours"), price_multiplier: 2 },
    { value: 24, label: t("rentals.oneDay"), price_multiplier: 3 },
    { value: 48, label: t("rentals.twoDays"), price_multiplier: 5 },
    { value: 72, label: t("rentals.threeDays"), price_multiplier: 7 },
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
                name: countryInfo?.name || countryInfo?.name_en || `Country ${id}`,
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
        message.error(t("rentals.getServiceDataFailed"));
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
      message.error(t("rentals.insufficientBalance"));
      return;
    }

    if (!selectedService || !selectedCountry || !selectedDuration) {
      message.error(t("rentals.pleaseCompleteAllSelections"));
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
        message.success(t("rentals.rentalOrderCreated"));
        setModalVisible(false);
        setCurrentStep(0);
        setSelectedService(null);
        setSelectedDuration(1);
        setSelectedCountry(null);
        setCountrySearch("");
        setVisibleCountries(20);
        setServiceSearch("");

        // 跳转到租用记录页面
        navigate("rentals");
      } else {
        throw new Error(t("rentals.rentalFailed"));
      }
    } catch (error: any) {
      console.error("租用失败:", error);
      message.error(
        getApiErrorMessage(error.response?.data?.error, t("rentals.rentalOrderFailed"))
      );
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
    const countryName = getLocalizedName(country).toLowerCase();
    const matchesSearch = countryName.includes(countrySearch.toLowerCase());
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
    { title: t("rentals.selectService") },
    { title: t("rentals.selectDuration") },
    { title: t("rentals.selectCountry") },
    { title: t("rentals.confirmRental") },
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
            <Title level={2}>{t("rentals.rentalService")}</Title>
            <Paragraph
              style={{
                fontSize: "16px",
                maxWidth: "600px",
                margin: "0 auto 32px",
              }}
            >
              {t("rentals.rentalDescription")}
            </Paragraph>

            {/* 余额显示 */}
            <div style={{ marginBottom: "24px" }}>
              <Text type="secondary">{t("rentals.currentBalance")}: </Text>
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
              {dataLoading ? t("rentals.loading") : t("rentals.startRenting")}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 租用服务选择模态框 */}
      <Modal
        title={t("rentals.selectRentalService")}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Spin spinning={dataLoading} tip={t("rentals.loadingServiceInfo")}>
          {/* 步骤条 */}
          <Steps current={currentStep} style={{ marginBottom: "32px" }}>
            {steps.map((step, index) => (
              <Steps.Step key={index} title={step.title} />
            ))}
          </Steps>

          {/* 步骤内容 */}
          {currentStep === 0 && (
            <div>
              <Title level={4}>{t("rentals.selectRentalServiceType")}</Title>

              {/* 服务搜索 */}
              <div style={{ marginBottom: "24px" }}>
                <Input
                  placeholder={t("rentals.searchServiceNameOrDescription")}
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
                    <Text type="secondary">
                      {t("rentals.foundServices", { count: filteredServices?.length || 0 })}
                    </Text>
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
                              {getLocalizedName(service) || "Unknown Service"}
                            </Title>
                          </div>

                          <Paragraph style={{ marginBottom: "16px" }}>
                            {getLocalizedName({
                              name: service.description,
                              name_cn: service.description_cn,
                            }) || "No description available"}
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
                              <Text type="secondary">{t("rentals.successRate")}:</Text>
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
                              <Text type="secondary">{t("rentals.basePrice")}:</Text>
                              <Tag color="blue">
                                ${(service.base_price || 0).toFixed(2)}
                                {t("rentals.perHour")}
                              </Tag>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text type="secondary">{t("rentals.availableQuantity")}:</Text>
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
                    <Text type="secondary">
                      {t("rentals.totalRentalServices", { count: services?.length || 0 })}
                    </Text>
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
                              {getLocalizedName(service) || "Unknown Service"}
                            </Title>
                          </div>

                          <Paragraph style={{ marginBottom: "16px" }}>
                            {getLocalizedName({
                              name: service.description,
                              name_cn: service.description_cn,
                            }) || "No description available"}
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
                              <Text type="secondary">{t("rentals.successRate")}:</Text>
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
                              <Text type="secondary">{t("rentals.basePrice")}:</Text>
                              <Tag color="blue">
                                ${(service.base_price || 0).toFixed(2)}
                                {t("rentals.perHour")}
                              </Tag>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text type="secondary">{t("rentals.availableQuantity")}:</Text>
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
              <Title level={4}>{t("rentals.selectDuration")}</Title>
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
                    alt={`${getLocalizedName(selectedService)} icon`}
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
                    {t("rentals.selectedService")}:{" "}
                    {getLocalizedName(selectedService) || "Unknown Service"}
                  </Text>
                </div>
                {t("rentals.basePrice")}:{" "}
                <Text strong style={{ color: "#722ed1" }}>
                  ${(selectedService?.base_price || 0).toFixed(2)}
                  {t("rentals.perHour")}
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
                          {duration.label}
                        </Title>
                        <div style={{ marginTop: "8px" }}>
                          <Text type="secondary">{t("rentals.priceMultiplier")}: </Text>
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
                <Title level={5}>{t("rentals.customDuration")}</Title>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <InputNumber
                    min={1}
                    max={168} // 7天
                    value={customDuration}
                    onChange={(value) => setCustomDuration(value || 1)}
                    addonAfter={t("rentals.hours")}
                    style={{ width: "120px" }}
                  />
                  <Text type="secondary">
                    {t("rentals.basePrice")}: $
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
                  {t("rentals.customDurationDescription")}
                </Text>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <Title level={4}>{t("rentals.selectCountry")}</Title>
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
                    alt={`${getLocalizedName(selectedService)} icon`}
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
                    {t("rentals.selectedService")}:{" "}
                    {getLocalizedName(selectedService) || "Unknown Service"}
                  </Text>
                </div>
                {t("rentals.selectedDuration")}:{" "}
                <Text strong>
                  {selectedDuration} {t("rentals.hours")}
                </Text>
                <br />
                {t("rentals.basePrice")}:{" "}
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
                    placeholder={t("rentals.selectRegion")}
                    value={selectedRegion}
                    onChange={setSelectedRegion}
                    style={{ width: "150px" }}
                    allowClear
                  >
                    <Select.Option value="all">{t("rentals.allRegions")}</Select.Option>
                    <Select.Option value="Europe">{t("rentals.europe")}</Select.Option>
                    <Select.Option value="Asia">{t("rentals.asia")}</Select.Option>
                    <Select.Option value="Africa">{t("rentals.africa")}</Select.Option>
                    <Select.Option value="Americas">{t("rentals.americas")}</Select.Option>
                    <Select.Option value="Oceania">{t("rentals.oceania")}</Select.Option>
                  </Select>
                  <Input
                    placeholder={t("rentals.searchCountryName")}
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
                            alt={`${getLocalizedName(country)} flag`}
                            style={{
                              width: "24px",
                              height: "18px",
                              marginRight: "8px",
                              borderRadius: "2px",
                            }}
                          />
                          <div>
                            <Text strong>{getLocalizedName(country)}</Text>
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
                          {t("rentals.priceMultiplier")}: {country.price_multiplier}x
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
                    {t("rentals.showMore", { count: filteredCountries.length - visibleCountries })}
                  </Button>
                </div>
              )}

              {/* 搜索结果统计 */}
              <div style={{ textAlign: "center", marginTop: "16px" }}>
                <Text type="secondary">
                  {countrySearch
                    ? t("rentals.foundCountries", { count: filteredCountries?.length || 0 })
                    : t("rentals.totalCountries", {
                        count: countries?.length || 0,
                        visible: Math.min(visibleCountries, filteredCountries?.length || 0),
                      })}
                </Text>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <Title level={4}>{t("rentals.confirmRentalInfo")}</Title>

              <Card style={{ marginBottom: "24px" }}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text strong>{t("rentals.selectedService")}:</Text>
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
                      <Text>{getLocalizedName(selectedService) || "Unknown Service"}</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text strong>{t("rentals.rentalDuration")}:</Text>
                    <br />
                    <Text>
                      {selectedDuration} {t("rentals.hours")}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>{t("rentals.selectedCountry")}:</Text>
                    <br />
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <img
                        src={countries.find((c) => c.id === selectedCountry)?.flag}
                        alt={`${
                          countries.find((c) => c.id === selectedCountry)
                            ? getLocalizedName(countries.find((c) => c.id === selectedCountry)!)
                            : "Unknown Country"
                        } flag`}
                        style={{
                          width: "20px",
                          height: "15px",
                          marginRight: "8px",
                          borderRadius: "2px",
                        }}
                      />
                      <Text>
                        {countries.find((c) => c.id === selectedCountry)
                          ? getLocalizedName(countries.find((c) => c.id === selectedCountry)!)
                          : "Unknown Country"}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text strong>{t("rentals.finalPrice")}:</Text>
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
                  message={t("rentals.insufficientBalance")}
                  description={t("rentals.insufficientBalanceDescription", {
                    currentBalance: user?.balance?.toFixed(2) || "0.00",
                    totalPrice: getFinalPrice(),
                  })}
                  type="warning"
                  showIcon
                  style={{ marginBottom: "24px" }}
                  action={
                    <Button size="small" onClick={() => navigate("balance")}>
                      {t("rentals.rechargeNow")}
                    </Button>
                  }
                />
              )}

              {/* 服务说明 */}
              <Alert
                message={t("rentals.rentalInstructions")}
                description={t("rentals.rentalInstructionsDescription")}
                type="info"
                showIcon
                style={{ marginBottom: "24px" }}
              />

              {/* 费用明细 */}
              <Card title={t("rentals.costBreakdown")} size="small">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text>{t("rentals.basePrice")}:</Text>
                  <Text>
                    ${(selectedService?.base_price || 0).toFixed(2)}
                    {t("rentals.perHour")}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text>{t("rentals.durationMultiplier")}:</Text>
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
                  <Text>{t("rentals.countryMultiplier")}:</Text>
                  <Text>
                    {countries.find((c) => c.id === selectedCountry)?.price_multiplier || 1}x
                  </Text>
                </div>
                <Divider style={{ margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text strong>{t("rentals.total")}:</Text>
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
                <Button onClick={() => setCurrentStep(currentStep - 1)}>
                  {t("rentals.previousStep")}
                </Button>
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
                  {t("rentals.nextStep")}
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
                  {t("rentals.confirmRental")} (${getFinalPrice()})
                </Button>
              )}

              <Button onClick={handleReset}>{t("rentals.reselect")}</Button>
            </Space>
          </div>
        </Spin>
      </Modal>
    </div>
  );
};

export default RentNumberPage;
