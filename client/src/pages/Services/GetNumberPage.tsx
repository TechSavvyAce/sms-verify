import React, { useState, useEffect, useCallback } from "react";
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
  Input,
  Popconfirm,
  Tooltip,
  Collapse,
  InputNumber,
  Dropdown,
} from "antd";
import { MessageOutlined, ArrowRightOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { useLocation } from "react-router-dom";
import { useLocalizedNavigate } from "../../hooks/useLocalizedNavigate";
import { serviceCategories, countries, calculatePrice } from "../../data/services";
import { activationApi, serviceApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";

const { Title, Paragraph, Text } = Typography;

const GetNumberPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const navigate = useLocalizedNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string>("any");
  const [loading, setLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [visibleCountries, setVisibleCountries] = useState<number>(20);
  const [serviceSearch, setServiceSearch] = useState<string>("");

  // FreePrice 相关状态
  const [useFreePrice, setUseFreePrice] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(0);

  // 运营商相关状态
  const [operators, setOperators] = useState<Record<number, string[]>>({});
  const [loadingOperators, setLoadingOperators] = useState<boolean>(false);

  // 高级选项状态
  const [forward, setForward] = useState<number>(0);
  const [activationType, setActivationType] = useState<number>(0);
  const [language, setLanguage] = useState<string>("en");
  const [ref, setRef] = useState<string>("");
  const [phoneException, setPhoneException] = useState<string>("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);

  // 数量
  const [quantity, setQuantity] = useState<number>(1);
  const [minPrices, setMinPrices] = useState<Record<string, number>>({});
  const [serviceCountryPrices, setServiceCountryPrices] = useState<Record<number, number>>({});

  // 获取运营商列表
  const fetchOperators = useCallback(
    async (countryId: number) => {
      if (operators[countryId]) return; // 已经获取过了

      setLoadingOperators(true);
      try {
        const response = await activationApi.getOperators(countryId);
        if (response.success && response.data) {
          setOperators((prev) => ({
            ...prev,
            [countryId]: response.data[countryId] || [],
          }));
        }
      } catch (error) {
        console.error("获取运营商列表失败:", error);
        // 如果API失败，使用默认值
        const defaultOperators: Record<number, string[]> = {
          0: ["megafon", "mts", "beeline", "tele2", "rostelecom"], // Russia
          1: ["kyivstar", "life", "utel", "mts", "vodafone"], // Ukraine
          2: ["tele2", "beeline", "activ", "altel"], // Kazakhstan
        };
        setOperators((prev) => ({
          ...prev,
          [countryId]: defaultOperators[countryId] || [],
        }));
      } finally {
        setLoadingOperators(false);
      }
    },
    [operators]
  );

  // 处理 URL 参数（重新订购功能）
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const serviceParam = searchParams.get("service");
    const countryParam = searchParams.get("country");
    const operatorParam = searchParams.get("operator");

    if (serviceParam && countryParam) {
      // 查找对应的服务
      for (const category of serviceCategories) {
        const service = category.services.find((s) => s.code === serviceParam);
        if (service) {
          setSelectedService({
            ...service,
            category: category.name,
            category_cn: category.name_cn,
            categoryCode: category.code,
          });
          break;
        }
      }

      // 设置国家
      const countryId = parseInt(countryParam);
      if (!isNaN(countryId)) {
        setSelectedCountry(countryId);

        // 如果有运营商参数，设置运营商
        if (operatorParam) {
          setSelectedOperator(operatorParam);
        }

        // 自动打开模态框并跳到确认步骤
        setModalVisible(true);
        setCurrentStep(2);

        // 如果支持运营商选择，获取运营商列表
        if (supportsOperatorSelection(countryId)) {
          fetchOperators(countryId);
        }
      }
    }
  }, [location.search, fetchOperators]);

  // 加载所有服务的最小价格（DB）用于步骤1列表展示
  useEffect(() => {
    (async () => {
      try {
        const res = await serviceApi.getMinPrices();
        if (res.success && res.data) setMinPrices(res.data as any);
      } catch (e) {}
    })();
  }, []);

  // 计算单个号码最终价格（含国家系数）
  const getFinalPrice = () => {
    if (!selectedService || selectedCountry === null) return 0;
    // 优先使用DB价格
    if (serviceCountryPrices[selectedCountry] !== undefined) {
      return Number(serviceCountryPrices[selectedCountry]);
    }
    const country = countries.find((c) => c.id === selectedCountry);
    if (!country) return Number(selectedService.price);
    return calculatePrice(Number(selectedService.price), 1, country.price_multiplier);
  };

  // 计算总价 = 单价 * 数量
  const getTotalPrice = () => {
    const singlePrice = getFinalPrice();
    const total = singlePrice * Math.max(1, quantity || 1);
    return Math.round(total * 100) / 100; // Round to 2 decimal places
  };

  // 检查余额是否足够（按总价）
  const hasEnoughBalance = () => {
    const total = getTotalPrice();
    return user && user.balance >= total;
  };

  // 处理服务选择
  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    // 预取该服务的国家价格（DB）
    (async () => {
      try {
        const res = await serviceApi.getDbPricingByService(service.code);
        if (res.success && res.data) {
          const map: Record<number, number> = {} as any;
          Object.entries(res.data as any).forEach(([cid, price]) => {
            map[Number(cid)] = Number(price);
          });
          setServiceCountryPrices(map);
        } else {
          setServiceCountryPrices({});
        }
      } catch (e) {
        setServiceCountryPrices({});
      }
    })();
    setCurrentStep(1);
  };

  // 处理国家选择
  const handleCountrySelect = (countryId: number) => {
    setSelectedCountry(countryId);
    setSelectedOperator("any"); // 重置运营商选择
    setCurrentStep(2);

    // 如果支持运营商选择，获取运营商列表
    if (supportsOperatorSelection(countryId)) {
      fetchOperators(countryId);
    }
  };

  // 检查国家是否支持运营商选择
  const supportsOperatorSelection = (countryId: number) => {
    return [0, 1, 2].includes(countryId); // Russia, Ukraine, Kazakhstan
  };

  // 获取运营商选项
  const getOperatorOptions = (countryId: number) => {
    if (operators[countryId]) {
      return ["any", ...operators[countryId]];
    }
    return ["any"];
  };

  // 验证服务可用性（优先使用DB定价作为可用性判断）
  const validateServiceAvailability = async (service: string, country: number) => {
    // 如果DB存在该服务-国家的价格，则视为可用
    if (serviceCountryPrices[country] !== undefined) {
      return true;
    }
    // 回退到后端的价格查询（外部API），作为兜底
    try {
      const response = await activationApi.getPrices(service, country);
      return (
        response.success &&
        response.data &&
        response.data[country] &&
        response.data[country][service]
      );
    } catch (error) {
      console.error("验证服务可用性失败:", error);
      return false;
    }
  };

  // 确认订单（支持多个号码）
  const handleConfirmOrder = async () => {
    if (!selectedService || selectedCountry === null) {
      message.error(t("services.pleaseSelectServiceAndCountry"));
      return;
    }

    // 验证服务可用性
    setLoading(true);
    try {
      const isAvailable = await validateServiceAvailability(selectedService.code, selectedCountry);
      if (!isAvailable) {
        message.error(t("services.serviceNotAvailableInCountry"));
        return;
      }
    } catch (error) {
      message.error(t("services.failedToValidateService"));
      return;
    } finally {
      setLoading(false);
    }

    // 验证 FreePrice 模式
    if (useFreePrice && (!maxPrice || maxPrice <= 0)) {
      message.error(t("services.freePriceMaxPriceRequired"));
      return;
    }

    // 余额检查基于总价
    if (!hasEnoughBalance()) {
      message.error(t("services.insufficientBalance"));
      return;
    }

    setLoading(true);
    try {
      // 构建高级选项
      const advancedOptions = {
        forward,
        activationType,
        language,
        ref: ref || undefined,
        phoneException: phoneException || undefined,
      };

      const totalCount = Math.max(1, quantity || 1);
      let successCount = 0;
      let failureCount = 0;
      let firstActivation: any = null;
      for (let i = 0; i < totalCount; i += 1) {
        try {
          let response;
          if (useFreePrice && maxPrice > 0) {
            response = await activationApi.createWithFreePrice({
              service: selectedService.code,
              country: selectedCountry,
              operator: selectedOperator,
              maxPrice: maxPrice,
              ...advancedOptions,
            });
          } else {
            response = await activationApi.create({
              service: selectedService.code,
              country: selectedCountry,
              operator: selectedOperator,
              ...advancedOptions,
            });
          }

          if (response.success && response.data) {
            successCount += 1;
            if (!firstActivation) firstActivation = response.data;
          } else {
            failureCount += 1;
          }
        } catch (loopErr) {
          failureCount += 1;
        }
      }

      if (successCount > 0) {
        if (successCount === 1 && firstActivation) {
          if (useFreePrice && maxPrice > 0) {
            message.success(
              t("services.freePriceOrderCreated", {
                phoneNumber: firstActivation.phone_number,
                actualCost: firstActivation.actual_cost || firstActivation.cost,
              }),
              5
            );
          } else {
            message.success(
              t("services.orderCreatedSuccessfully", {
                phoneNumber: firstActivation.phone_number,
              }),
              5
            );
          }
        } else {
          message.success(
            t("services.multipleOrdersCreated", {
              successCount,
              failureCount: failureCount ? t("services.failureCount", { count: failureCount }) : "",
            }),
            5
          );
        }

        // 重置
        setModalVisible(false);
        setCurrentStep(0);
        setSelectedService(null);
        setSelectedCountry(null);
        setSelectedOperator("any");
        setCountrySearch("");
        setVisibleCountries(20);
        setServiceSearch("");
        setUseFreePrice(false);
        setMaxPrice(0);
        setOperators({});
        setForward(0);
        setActivationType(0);
        setLanguage("en");
        setRef("");
        setPhoneException("");
        setShowAdvancedOptions(false);
        setQuantity(1);

        // 跳转到激活记录页面
        navigate("activations");
      } else {
        throw new Error(t("services.orderCreationFailed"));
      }
    } catch (error: any) {
      console.error("创建激活订单失败:", error);
      const backendError = error.response?.data?.error;
      // 供应商余额不足的特殊提示
      if (
        typeof backendError === "string" &&
        (backendError.includes("余额不足") || backendError.toUpperCase?.().includes("NO_BALANCE"))
      ) {
        message.warning(t("services.providerNoBalance"));
      } else {
        let errorMessage = t("services.orderCreationFailedRetry");
        if (backendError) {
          errorMessage = getApiErrorMessage(backendError, t("services.orderCreationFailedRetry"));
        }
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // 重置选择
  const handleReset = () => {
    setCurrentStep(0);
    setSelectedCategory("");
    setSelectedService(null);
    setSelectedCountry(null);
    setCountrySearch("");
    setVisibleCountries(20);
    setServiceSearch("");
    setUseFreePrice(false);
    setMaxPrice(0);
    setSelectedOperator("any");
    setOperators({});
    setForward(0);
    setActivationType(0);
    setLanguage("en");
    setRef("");
    setPhoneException("");
    setShowAdvancedOptions(false);
    setQuantity(1);
  };

  // 过滤国家列表
  const filteredCountries = countries.filter(
    (country) =>
      country.name_cn.toLowerCase().includes(countrySearch.toLowerCase()) ||
      country.name_en.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // 显示更多国家
  const handleShowMore = () => {
    setVisibleCountries((prev) => prev + 20);
  };

  // 重置国家显示数量
  const resetCountryDisplay = () => {
    setVisibleCountries(20);
  };

  // 过滤服务列表
  const filteredServices = serviceCategories.flatMap((category) =>
    category.services
      .filter(
        (service) =>
          service.name_cn?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
          service.name?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
          category.name_cn?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
          category.name?.toLowerCase().includes(serviceSearch.toLowerCase())
      )
      .map((service) => ({
        ...service,
        category: category.name,
        category_cn: category.name_cn,
        categoryCode: category.code,
      }))
  );

  // 获取服务分类
  const getServiceCategories = () => {
    if (serviceSearch) {
      // 如果搜索，显示所有匹配的服务
      return [];
    }
    return serviceCategories;
  };

  // 根据当前语言获取本地化名称
  const getLocalizedName = (item: any) => {
    if (currentLanguage === "zh-CN") {
      return item.name_cn || item.name;
    } else {
      return item.name || item.name_cn;
    }
  };

  // 步骤配置
  const steps = [
    { title: t("services.selectService") },
    { title: t("services.selectCountry") },
    { title: t("services.confirmOrder") },
  ];

  return (
    <div>
      <Card>
        <Row align="middle" justify="center" style={{ minHeight: "400px" }}>
          <Col span={24} style={{ textAlign: "center" }}>
            <MessageOutlined
              style={{
                fontSize: "64px",
                color: "#1890ff",
                marginBottom: "24px",
              }}
            />
            <Title level={2}>{t("services.getVerificationCode")}</Title>
            <Paragraph
              style={{
                fontSize: "16px",
                maxWidth: "600px",
                margin: "0 auto 32px",
              }}
            >
              {t("services.serviceDescription")}
            </Paragraph>

            {/* 余额显示 */}
            <div style={{ marginBottom: "24px" }}>
              <Text type="secondary">{t("services.currentBalance")}: </Text>
              <Text strong style={{ fontSize: "18px", color: "#1890ff" }}>
                ${user?.balance?.toFixed(2) || "0.00"}
              </Text>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={() => setModalVisible(true)}
            >
              {t("services.startSelecting")}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 服务选择模态框 */}
      <Modal
        title={t("services.selectService")}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        {/* 步骤条 */}
        <Steps current={currentStep} style={{ marginBottom: "32px" }}>
          {steps.map((step, index) => (
            <Steps.Step key={index} title={step.title} />
          ))}
        </Steps>

        {/* 步骤内容 */}
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: "16px" }}>
                <Progress type="circle" percent={75} />
              </div>
              <Text strong>{t("services.processingOrder")}</Text>
              <br />
              <Text type="secondary">{t("services.pleaseWait")}</Text>
            </div>
          </div>
        )}

        {currentStep === 0 && (
          <div>
            <Title level={4}>{t("services.selectService")}</Title>

            {/* 服务搜索 */}
            <div style={{ marginBottom: "24px" }}>
              <Input
                placeholder={t("services.searchService")}
                value={serviceSearch}
                onChange={(e) => {
                  setServiceSearch(e.target.value);
                  setSelectedCategory("");
                }}
                style={{ maxWidth: "500px" }}
                allowClear
                size="large"
              />
            </div>

            {serviceSearch ? (
              // 搜索结果 - 显示所有匹配的服务
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <Text type="secondary">
                    {t("services.foundServices", { count: filteredServices.length })}
                  </Text>
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {filteredServices.map((service) => (
                    <div
                      key={service.code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        border: "1px solid #f0f0f0",
                        borderRadius: "8px",
                        marginBottom: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#1890ff";
                        e.currentTarget.style.backgroundColor = "#f6ffed";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#f0f0f0";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      onClick={() => handleServiceSelect(service)}
                    >
                      <div style={{ marginRight: "16px" }}>
                        <img
                          src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${service.code}0.webp`}
                          alt={`${service.name_cn || service.name} icon`}
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "block";
                          }}
                        />
                        <div
                          style={{
                            fontSize: "24px",
                            display: "none",
                            width: "40px",
                            height: "40px",
                            textAlign: "center",
                            lineHeight: "40px",
                          }}
                        >
                          📱
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
                          <Tag color="blue" style={{ marginRight: "8px", fontSize: "12px" }}>
                            {getLocalizedName({
                              name: service.category,
                              name_cn: service.category_cn,
                            })}
                          </Tag>
                          <Text strong style={{ fontSize: "16px" }}>
                            {getLocalizedName(service)}
                          </Text>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <Text type="secondary" style={{ fontSize: "12px", marginRight: "4px" }}>
                              {t("services.successRate")}:
                            </Text>
                            <Progress
                              percent={service.success_rate}
                              size="small"
                              showInfo={false}
                              strokeColor={
                                service.success_rate >= 95
                                  ? "#52c41a"
                                  : service.success_rate >= 90
                                    ? "#faad14"
                                    : "#ff4d4f"
                              }
                              style={{ width: "60px", marginRight: "4px" }}
                            />
                            <Text strong style={{ fontSize: "12px" }}>
                              {service.success_rate}%
                            </Text>
                          </div>

                          <div style={{ display: "flex", alignItems: "center" }}>
                            <ClockCircleOutlined style={{ marginRight: "4px", fontSize: "12px" }} />
                            <Text type="secondary" style={{ fontSize: "12px" }}>
                              {t("services.estimatedTime")}
                            </Text>
                          </div>

                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            {t("services.available")}: {service.available}
                          </Text>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <Tag color="green" style={{ fontSize: "16px", padding: "4px 12px" }}>
                          ${minPrices[service.code] !== undefined ? minPrices[service.code] : service.price}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // 分类浏览 - 显示服务分类
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <Text type="secondary">{t("services.selectServiceCategory")}</Text>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  {getServiceCategories().map((category) => (
                    <div
                      key={category.code}
                      style={{
                        border: "1px solid #f0f0f0",
                        borderRadius: "8px",
                        marginBottom: "8px",
                        overflow: "hidden",
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "12px 16px",
                          backgroundColor:
                            selectedCategory === category.code ? "#e6f7ff" : "#fafafa",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onClick={() =>
                          setSelectedCategory(
                            selectedCategory === category.code ? "" : category.code
                          )
                        }
                      >
                        <span style={{ fontSize: "20px", marginRight: "12px" }}>
                          {category.icon}
                        </span>
                        <Text
                          strong
                          style={{
                            fontSize: "16px",
                            color: selectedCategory === category.code ? "#1890ff" : "#262626",
                            flex: 1,
                          }}
                        >
                          {getLocalizedName(category)}
                        </Text>
                        <Tag
                          color={selectedCategory === category.code ? "blue" : "default"}
                          style={{ fontSize: "12px", padding: "2px 8px" }}
                        >
                          {category.services.length}
                        </Tag>
                        <span
                          style={{
                            marginLeft: "12px",
                            fontSize: "14px",
                            color: "#8c8c8c",
                            transform:
                              selectedCategory === category.code ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        >
                          ▶
                        </span>
                      </div>

                      {/* Services List */}
                      {selectedCategory === category.code && (
                        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                          {category.services.map((service, index) => (
                            <div
                              key={service.code}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "12px 16px",
                                borderBottom:
                                  index === category.services.length - 1
                                    ? "none"
                                    : "1px solid #f0f0f0",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                backgroundColor: "#fff",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#f6ffed";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }}
                              onClick={() =>
                                handleServiceSelect({
                                  ...service,
                                  category: category.name,
                                  category_cn: category.name_cn,
                                  categoryCode: category.code,
                                })
                              }
                            >
                              <img
                                src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${service.code}0.webp`}
                                alt={`${service.name_cn || service.name} icon`}
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

                              <div style={{ flex: 1 }}>
                                <Text
                                  strong
                                  style={{
                                    fontSize: "14px",
                                    display: "block",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {getLocalizedName(service)}
                                </Text>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                  <div style={{ display: "flex", alignItems: "center" }}>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: "11px", marginRight: "4px" }}
                                    >
                                      {t("services.successRate")}:
                                    </Text>
                                    <Progress
                                      percent={service.success_rate}
                                      size="small"
                                      showInfo={false}
                                      strokeColor={
                                        service.success_rate >= 95
                                          ? "#52c41a"
                                          : service.success_rate >= 90
                                            ? "#faad14"
                                            : "#ff4d4f"
                                      }
                                      style={{ width: "50px", marginRight: "4px" }}
                                    />
                                    <Text strong style={{ fontSize: "11px" }}>
                                      {service.success_rate}%
                                    </Text>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center" }}>
                                    <ClockCircleOutlined
                                      style={{ marginRight: "4px", fontSize: "11px" }}
                                    />
                                    <Text type="secondary" style={{ fontSize: "11px" }}>
                                      {t("services.estimatedTime")}
                                    </Text>
                                  </div>

                                  <Text type="secondary" style={{ fontSize: "11px" }}>
                                    {t("services.available")}: {service.available}
                                  </Text>
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <Tag color="green" style={{ fontSize: "14px", padding: "4px 8px" }}>
                                  ${minPrices[service.code] !== undefined ? minPrices[service.code] : service.price}
                                </Tag>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Title level={4}>{t("services.selectCountry")}</Title>
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
                  alt={`${selectedService?.name} icon`}
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
                  {t("services.selectedService")}:{" "}
                  {selectedService ? getLocalizedName(selectedService) : ""}
                </Text>
              </div>
              {t("services.basePrice")}:{" "}
              <Text strong style={{ color: "#1890ff" }}>
                ${selectedService?.price}
              </Text>
            </Paragraph>

            {/* 余额提醒 */}
            {!hasEnoughBalance() && (
              <Alert
                message={t("services.insufficientBalance")}
                description={t("services.insufficientBalanceDescription", {
                  currentBalance: user?.balance?.toFixed(2) || "0.00",
                })}
                type="warning"
                showIcon
                style={{ marginBottom: "16px" }}
                action={
                  <Button size="small" type="primary" onClick={() => navigate("balance")}>
                    {t("dashboard.rechargeNow")}
                  </Button>
                }
              />
            )}

            {/* 国家搜索 */}
            <div style={{ marginBottom: "16px" }}>
              <Input
                placeholder={t("services.searchCountry")}
                value={countrySearch}
                onChange={(e) => {
                  setCountrySearch(e.target.value);
                  resetCountryDisplay();
                }}
                style={{ maxWidth: "400px" }}
                allowClear
              />
            </div>

            <Row gutter={[16, 16]}>
              {filteredCountries.slice(0, visibleCountries).map((country) => (
                <Col xs={24} sm={12} lg={8} key={country.id}>
                  <Card
                    hoverable
                    style={{
                      cursor: "pointer",
                      border: selectedCountry === country.id ? "2px solid #1890ff" : undefined,
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
                        <Text strong>{getLocalizedName(country)}</Text>
                      </div>
                      <Tag color="green">
                        ${
                          selectedService && serviceCountryPrices[country.id] !== undefined
                            ? serviceCountryPrices[country.id].toFixed(2)
                            : (selectedService?.price * country.price_multiplier).toFixed(2)
                        }
                      </Tag>
                    </div>

                    {country.price_multiplier !== 1.0 && (
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {t("services.priceMultiplier")}: {country.price_multiplier}x
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
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                >
                  {t("services.showMore", { count: filteredCountries.length - visibleCountries })}
                </Button>
              </div>
            )}

            {/* 搜索结果统计 */}
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <Text type="secondary">
                {countrySearch
                  ? t("services.foundCountries", { count: filteredCountries.length })
                  : t("services.totalCountries", {
                      total: countries.length,
                      visible: Math.min(visibleCountries, filteredCountries.length),
                    })}
              </Text>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <Title level={4}>{t("services.confirmOrder")}</Title>

            <Card style={{ marginBottom: "24px" }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>{t("services.selectedService")}:</Text>
                  <br />
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <img
                      src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${selectedService?.code}0.webp`}
                      alt={`${selectedService?.name_cn || selectedService?.name} icon`}
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
                    <Text>{selectedService ? getLocalizedName(selectedService) : ""}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text strong>{t("services.selectedCountry")}:</Text>
                  <br />
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <img
                      src={countries.find((c) => c.id === selectedCountry)?.flag}
                      alt={`${countries.find((c) => c.id === selectedCountry) ? getLocalizedName(countries.find((c) => c.id === selectedCountry)!) : ""} flag`}
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
                        : ""}
                    </Text>
                  </div>
                </Col>

                {/* 数量选择 */}
                <Col span={24}>
                  <div style={{ marginTop: "4px" }}>
                    <Text strong>{t("services.quantity")}:</Text>
                    <Space style={{ marginLeft: "8px" }}>
                      <InputNumber
                        min={1}
                        max={20}
                        value={quantity}
                        onChange={(val) => setQuantity(Number(val) || 1)}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("services.multipleNumbersHint")}
                      </Text>
                    </Space>
                  </div>
                </Col>

                <Col span={12}>
                  <Text strong>{t("services.basePrice")}:</Text>
                  <br />
                  <Text>${selectedService?.price}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>{t("services.finalPrice")}:</Text>
                  <br />
                  <Text strong style={{ fontSize: "18px", color: "#1890ff" }}>
                    ${getFinalPrice()} x {quantity} = ${getTotalPrice()}
                  </Text>
                </Col>

                {/* 高级选项 - 可折叠 */}
                <Col span={24}>
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ marginBottom: "16px" }}>
                      <Button
                        type="link"
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                        style={{ padding: 0, height: "auto" }}
                      >
                        {showAdvancedOptions ? t("services.collapse") : t("services.expand")}{" "}
                        {t("services.advancedOptions")}
                        <Text type="secondary" style={{ marginLeft: "8px", fontSize: "12px" }}>
                          ({t("services.advancedOptionsHint")})
                        </Text>
                      </Button>
                    </div>

                    {showAdvancedOptions && (
                      <Collapse defaultActiveKey={["1"]} ghost>
                        <Collapse.Panel header={t("services.basicOptions")} key="1">
                          <Space direction="vertical" style={{ width: "100%" }}>
                            {/* 转发选项 */}
                            <div>
                              <Text>{t("services.forwardOptions")}:</Text>
                              <Space>
                                <Tag
                                  color={forward === 0 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setForward(0)}
                                >
                                  {t("services.noForward")}
                                </Tag>
                                <Tag
                                  color={forward === 1 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setForward(1)}
                                >
                                  {t("services.forward")}
                                </Tag>
                              </Space>
                            </div>

                            {/* 激活类型 */}
                            <div>
                              <Text>{t("services.activationType")}:</Text>
                              <Space>
                                <Tag
                                  color={activationType === 0 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setActivationType(0)}
                                >
                                  {t("services.sms")}
                                </Tag>
                                <Tag
                                  color={activationType === 1 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setActivationType(1)}
                                >
                                  {t("services.number")}
                                </Tag>
                                <Tag
                                  color={activationType === 2 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setActivationType(2)}
                                >
                                  {t("services.voice")}
                                </Tag>
                              </Space>
                            </div>

                            {/* 语言选择 */}
                            <div>
                              <Text>{t("services.language")}:</Text>
                              <Space>
                                <Tag
                                  color={language === "en" ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setLanguage("en")}
                                >
                                  {t("services.english")}
                                </Tag>
                                <Tag
                                  color={language === "ru" ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setLanguage("ru")}
                                >
                                  {t("services.russian")}
                                </Tag>
                                <Tag
                                  color={language === "cn" ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setLanguage("cn")}
                                >
                                  {t("services.chinese")}
                                </Tag>
                              </Space>
                            </div>

                            {/* 运营商选择 */}
                            {supportsOperatorSelection(selectedCountry!) && (
                              <div>
                                <Text>{t("services.operatorSelection")}:</Text>
                                <div style={{ marginTop: "8px" }}>
                                  {loadingOperators ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <Progress type="circle" percent={75} size="small" />
                                      <Text type="secondary">{t("services.loadingOperators")}</Text>
                                    </div>
                                  ) : (
                                    getOperatorOptions(selectedCountry!).map((operator) => (
                                      <Tag
                                        key={operator}
                                        color={selectedOperator === operator ? "blue" : "default"}
                                        style={{
                                          cursor: "pointer",
                                          marginRight: "8px",
                                          marginBottom: "8px",
                                          padding: "4px 8px",
                                        }}
                                        onClick={() => setSelectedOperator(operator)}
                                      >
                                        {operator === "any" ? t("services.anyOperator") : operator}
                                      </Tag>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </Space>
                        </Collapse.Panel>

                        <Collapse.Panel header={t("services.advancedOptionalOptions")} key="2">
                          <Space direction="vertical" style={{ width: "100%" }}>
                            {/* 推荐ID */}
                            <div>
                              <Text>{t("services.referralId")}:</Text>
                              <Input
                                value={ref}
                                onChange={(e) => setRef(e.target.value)}
                                placeholder={t("services.referralIdPlaceholder")}
                                style={{ width: "200px" }}
                              />
                              <Text type="secondary" style={{ fontSize: "12px" }}>
                                {t("services.referralIdDescription")}
                              </Text>
                            </div>

                            {/* 电话号码排除 */}
                            <div>
                              <Text>{t("services.phoneException")}:</Text>
                              <Input
                                value={phoneException}
                                onChange={(e) => setPhoneException(e.target.value)}
                                placeholder={t("services.phoneExceptionPlaceholder")}
                                style={{ width: "300px" }}
                              />
                              <Text type="secondary" style={{ fontSize: "12px" }}>
                                {t("services.phoneExceptionDescription")}
                              </Text>
                            </div>
                          </Space>
                        </Collapse.Panel>

                        <Collapse.Panel header={t("services.freePriceMode")} key="3">
                          <div>
                            <div style={{ marginBottom: "8px" }}>
                              <Text type="secondary">{t("services.freePriceDescription")}</Text>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <Button
                                type={useFreePrice ? "primary" : "default"}
                                size="small"
                                onClick={() => setUseFreePrice(!useFreePrice)}
                              >
                                {useFreePrice
                                  ? t("services.enabled")
                                  : t("services.enableFreePrice")}
                              </Button>
                              {useFreePrice && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <Text type="secondary">{t("services.maxPrice")}:</Text>
                                  <Input
                                    type="number"
                                    placeholder={t("services.maxPricePlaceholder")}
                                    value={maxPrice || ""}
                                    onChange={(e) => setMaxPrice(Number(e.target.value) || 0)}
                                    style={{ width: "120px" }}
                                    addonAfter="USD"
                                    min={0}
                                    step={0.01}
                                  />
                                </div>
                              )}
                            </div>
                            {useFreePrice && maxPrice > 0 && (
                              <div style={{ marginTop: "8px" }}>
                                <Text type="secondary" style={{ fontSize: "12px" }}>
                                  {t("services.freePriceTip", { maxPrice })}
                                </Text>
                                <div style={{ marginTop: "4px" }}>
                                  <Text type="secondary" style={{ fontSize: "12px" }}>
                                    {t("services.currentPrice", {
                                      currentPrice: getFinalPrice(),
                                      maxPrice,
                                    })}
                                  </Text>
                                </div>
                              </div>
                            )}
                          </div>
                        </Collapse.Panel>
                      </Collapse>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 余额检查 */}
            {!hasEnoughBalance() && (
              <Alert
                message={t("services.insufficientBalanceAlert")}
                description={t("services.insufficientBalanceDescription", {
                  currentBalance: user?.balance?.toFixed(2) || "0.00",
                  totalPrice: getTotalPrice(),
                })}
                type="warning"
                showIcon
                style={{ marginBottom: "24px" }}
                action={
                  <Button size="small" onClick={() => navigate("balance")}>
                    {t("services.rechargeNow")}
                  </Button>
                }
              />
            )}

            {/* 服务说明 */}
            <Alert
              message={t("services.serviceInstructions")}
              description={t("services.serviceInstructionsDescription")}
              type="info"
              showIcon
              style={{ marginBottom: "24px" }}
            />

            {/* 订单详情 */}
            <Card size="small" style={{ marginBottom: "24px" }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">{t("services.serviceType")}:</Text>
                  <br />
                  <Text>
                    {selectedService
                      ? getLocalizedName({
                          name: selectedService.category,
                          name_cn: selectedService.category_cn,
                        })
                      : ""}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">{t("services.estimatedAllocationTime")}:</Text>
                  <br />
                  <Text>{t("services.estimatedTime")}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">{t("services.numberValidity")}:</Text>
                  <br />
                  <Text>{t("services.validityTime")}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">{t("services.supportedServices")}:</Text>
                  <br />
                  <Text>{selectedService?.description || t("services.smsVerification")}</Text>
                </Col>
              </Row>
            </Card>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <Space size="middle">
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>
                {t("services.previousStep")}
              </Button>
            )}

            {currentStep < 2 && (
              <Tooltip
                title={
                  currentStep === 1 && !hasEnoughBalance()
                    ? t("services.insufficientBalance")
                    : undefined
                }
              >
                <Button
                  type="primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={
                    (currentStep === 0 && !selectedService) ||
                    (currentStep === 1 && selectedCountry === null) ||
                    (currentStep === 1 && !hasEnoughBalance())
                  }
                >
                  {t("services.nextStep")}
                </Button>
              </Tooltip>
            )}

            {currentStep === 2 && (
              <Popconfirm
                title={t("services.confirmOrder")}
                description={t("services.confirmOrderDescription", {
                  serviceName: selectedService ? getLocalizedName(selectedService) : "",
                  totalPrice: getTotalPrice(),
                })}
                onConfirm={handleConfirmOrder}
                okText={t("services.confirm")}
                cancelText={t("services.cancel")}
                okButtonProps={{ loading: loading }}
              >
                <Button type="primary" size="large" disabled={!hasEnoughBalance()}>
                  {loading
                    ? t("services.processing")
                    : t("services.confirmOrderButton", { totalPrice: getTotalPrice() })}
                </Button>
              </Popconfirm>
            )}

            <Button onClick={handleReset}>{t("services.reselect")}</Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default GetNumberPage;
