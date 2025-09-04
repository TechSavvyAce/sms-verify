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
} from "antd";
import { MessageOutlined, ArrowRightOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate, useLocation } from "react-router-dom";
import { serviceCategories, countries, calculatePrice } from "../../data/services";
import { activationApi } from "../../services/api";
import { getApiErrorMessage } from "../../utils/errorHelpers";

const { Title, Paragraph, Text } = Typography;

const GetNumberPage: React.FC = () => {
  const navigate = useNavigate();
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

  // 计算单个号码最终价格（含国家系数）
  const getFinalPrice = () => {
    if (!selectedService || selectedCountry === null) return 0;
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

  // 确认订单（支持多个号码）
  const handleConfirmOrder = async () => {
    if (!selectedService || selectedCountry === null) {
      message.error("请选择服务和国家");
      return;
    }

    // 验证 FreePrice 模式
    if (useFreePrice && (!maxPrice || maxPrice <= 0)) {
      message.error("FreePrice 模式下必须设置有效的最大价格");
      return;
    }

    // 余额检查基于总价
    if (!hasEnoughBalance()) {
      message.error("余额不足，请先充值");
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
              `FreePrice 订单创建成功！已分配号码: ${firstActivation.phone_number} | 实际价格: ${
                firstActivation.actual_cost || firstActivation.cost
              } USD`,
              5
            );
          } else {
            message.success(`订单创建成功！已分配号码: ${firstActivation.phone_number}`, 5);
          }
        } else {
          message.success(
            `已成功创建 ${successCount} 个订单${failureCount ? `，失败 ${failureCount} 个` : ""}`,
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
        navigate("/activations");
      } else {
        throw new Error("订单创建失败");
      }
    } catch (error: any) {
      console.error("创建激活订单失败:", error);
      let errorMessage = "订单创建失败，请重试";
      if (error.response?.data?.error) {
        const backendError = error.response.data.error;
        errorMessage = getApiErrorMessage(backendError, "订单创建失败，请重试");
      }
      message.error(errorMessage);
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

  // 步骤配置
  const steps = [
    { title: "选择服务", description: "选择您需要的验证码服务" },
    { title: "选择国家", description: "选择手机号码所属国家" },
    { title: "确认订单", description: "确认订单信息并支付" },
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
            <Title level={2}>获取验证码服务</Title>
            <Paragraph
              style={{
                fontSize: "16px",
                maxWidth: "600px",
                margin: "0 auto 32px",
              }}
            >
              选择服务平台和国家地区，我们将为您提供临时手机号码来接收短信验证码。
              支持全球主流平台，快速稳定，价格透明。
            </Paragraph>

            {/* 余额显示 */}
            <div style={{ marginBottom: "24px" }}>
              <Text type="secondary">当前余额: </Text>
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
              开始选择服务
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 服务选择模态框 */}
      <Modal
        title="选择验证码服务"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        {/* 步骤条 */}
        <Steps current={currentStep} style={{ marginBottom: "32px" }}>
          {steps.map((step, index) => (
            <Steps.Step key={index} title={step.title} description={step.description} />
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
              <Text strong>正在处理您的订单...</Text>
              <br />
              <Text type="secondary">请稍候，正在分配手机号码</Text>
            </div>
          </div>
        )}

        {currentStep === 0 && (
          <div>
            <Title level={4}>选择验证码服务</Title>

            {/* 服务搜索 */}
            <div style={{ marginBottom: "24px" }}>
              <Input
                placeholder="搜索服务名称或分类（支持中文和英文）"
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
                  <Text type="secondary">找到 {filteredServices.length} 个相关服务</Text>
                </div>
                <Row gutter={[16, 16]}>
                  {filteredServices.map((service) => (
                    <Col xs={24} sm={12} lg={8} key={service.code}>
                      <Card
                        hoverable
                        style={{ cursor: "pointer" }}
                        onClick={() => handleServiceSelect(service)}
                      >
                        <div style={{ textAlign: "center", marginBottom: "16px" }}>
                          <img
                            src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${service.code}0.webp`}
                            alt={`${service.name_cn || service.name} icon`}
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "8px",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              // Fallback to emoji if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = "block";
                            }}
                          />
                          <div
                            style={{
                              fontSize: "32px",
                              marginBottom: "8px",
                              display: "none",
                            }}
                          >
                            📱
                          </div>
                        </div>
                        <div style={{ marginBottom: "12px" }}>
                          <Tag color="blue" style={{ marginBottom: "8px" }}>
                            {service.category_cn || service.category}
                          </Tag>
                          <Title level={5} style={{ margin: 0 }}>
                            {service.name_cn || service.name}
                          </Title>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <Text type="secondary">成功率: </Text>
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
                          />
                          <Text strong style={{ marginLeft: "8px" }}>
                            {service.success_rate}%
                          </Text>
                        </div>

                        <div style={{ marginBottom: "12px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Text type="secondary">
                              <ClockCircleOutlined style={{ marginRight: "4px" }} />
                              预计 2-5 分钟
                            </Text>
                            <Text type="secondary">可用: {service.available}</Text>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <Tag color="green" style={{ fontSize: "16px", padding: "4px 8px" }}>
                            ${service.price}
                          </Tag>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ) : (
              // 分类浏览 - 显示服务分类
              <div>
                <div style={{ marginBottom: "16px" }}>
                  <Text type="secondary">选择服务分类或使用搜索快速查找</Text>
                </div>
                <Row gutter={[16, 16]}>
                  {getServiceCategories().map((category) => (
                    <Col xs={24} sm={12} lg={6} key={category.code}>
                      <Card
                        hoverable
                        style={{ textAlign: "center", cursor: "pointer" }}
                        onClick={() => setSelectedCategory(category.code)}
                      >
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}>{category.icon}</div>
                        <Title level={5}>{category.name_cn || category.name}</Title>
                        <Text type="secondary">{category.services.length} 个服务</Text>
                      </Card>
                    </Col>
                  ))}
                </Row>

                {selectedCategory && (
                  <div style={{ marginTop: "32px" }}>
                    <Divider />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                      }}
                    >
                      <Title level={4} style={{ margin: 0 }}>
                        {serviceCategories.find((c) => c.code === selectedCategory)?.name_cn ||
                          serviceCategories.find((c) => c.code === selectedCategory)?.name}
                      </Title>
                      <Button
                        type="link"
                        onClick={() => setSelectedCategory("")}
                        icon={<ArrowRightOutlined />}
                      >
                        返回分类
                      </Button>
                    </div>
                    <Row gutter={[16, 16]}>
                      {serviceCategories
                        .find((c) => c.code === selectedCategory)
                        ?.services.map((service) => (
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
                                <img
                                  src={`https://smsactivate.s3.eu-central-1.amazonaws.com/assets/ico/${service.code}0.webp`}
                                  alt={`${service.name_cn || service.name} icon`}
                                  style={{
                                    width: "48px",
                                    height: "48px",
                                    borderRadius: "8px",
                                    objectFit: "cover",
                                  }}
                                  onError={(e) => {
                                    // Fallback to emoji if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    const fallback = target.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = "block";
                                  }}
                                />
                                <div
                                  style={{
                                    fontSize: "32px",
                                    marginBottom: "8px",
                                    display: "none",
                                  }}
                                >
                                  📱
                                </div>
                              </div>
                              <div style={{ marginBottom: "12px" }}>
                                <Title level={5} style={{ margin: 0 }}>
                                  {service.name_cn || service.name}
                                </Title>
                              </div>

                              <div style={{ marginBottom: "12px" }}>
                                <Text type="secondary">成功率: </Text>
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
                                />
                                <Text strong style={{ marginLeft: "8px" }}>
                                  {service.success_rate}%
                                </Text>
                              </div>

                              <div style={{ marginBottom: "12px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text type="secondary">
                                    <ClockCircleOutlined style={{ marginRight: "4px" }} />
                                    预计 2-5 分钟
                                  </Text>
                                  <Text type="secondary">可用: {service.available}</Text>
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <Tag
                                  color="green"
                                  style={{
                                    fontSize: "16px",
                                    padding: "4px 8px",
                                  }}
                                >
                                  ${service.price}
                                </Tag>
                              </div>
                            </Card>
                          </Col>
                        ))}
                    </Row>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentStep === 1 && (
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
                <Text strong>已选择服务: {selectedService?.name}</Text>
              </div>
              基础价格:{" "}
              <Text strong style={{ color: "#1890ff" }}>
                ${selectedService?.price}
              </Text>
            </Paragraph>

            {/* 余额提醒 */}
            {!hasEnoughBalance() && (
              <Alert
                message="余额不足提醒"
                description={`当前余额 $${
                  user?.balance?.toFixed(2) || "0.00"
                }，不足以购买此服务。请先充值。`}
                type="warning"
                showIcon
                style={{ marginBottom: "16px" }}
                action={
                  <Button size="small" type="primary" onClick={() => navigate("/balance")}>
                    立即充值
                  </Button>
                }
              />
            )}

            {/* 国家搜索 */}
            <div style={{ marginBottom: "16px" }}>
              <Input
                placeholder="搜索国家名称（支持中文和英文）"
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
                          alt={`${country.name_cn} flag`}
                          style={{
                            width: "24px",
                            height: "18px",
                            marginRight: "8px",
                            borderRadius: "2px",
                          }}
                        />
                        <Text strong>{country.name_cn}</Text>
                      </div>
                      <Tag color="green">
                        ${(selectedService?.price * country.price_multiplier).toFixed(2)}
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
                  style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
                >
                  显示更多 (还有 {filteredCountries.length - visibleCountries} 个国家)
                </Button>
              </div>
            )}

            {/* 搜索结果统计 */}
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <Text type="secondary">
                {countrySearch
                  ? `找到 ${filteredCountries.length} 个国家`
                  : `共 ${countries.length} 个国家，显示 ${Math.min(
                      visibleCountries,
                      filteredCountries.length
                    )} 个`}
              </Text>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <Title level={4}>确认订单信息</Title>

            <Card style={{ marginBottom: "24px" }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>选择的服务:</Text>
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
                    <Text>{selectedService?.name_cn || selectedService?.name}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text strong>选择的国家:</Text>
                  <br />
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <img
                      src={countries.find((c) => c.id === selectedCountry)?.flag}
                      alt={`${countries.find((c) => c.id === selectedCountry)?.name_cn} flag`}
                      style={{
                        width: "20px",
                        height: "15px",
                        marginRight: "8px",
                        borderRadius: "2px",
                      }}
                    />
                    <Text>{countries.find((c) => c.id === selectedCountry)?.name_cn}</Text>
                  </div>
                </Col>

                {/* 数量选择 */}
                <Col span={24}>
                  <div style={{ marginTop: "4px" }}>
                    <Text strong>数量:</Text>
                    <Space style={{ marginLeft: "8px" }}>
                      <InputNumber
                        min={1}
                        max={20}
                        value={quantity}
                        onChange={(val) => setQuantity(Number(val) || 1)}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        一次可下单多个号码
                      </Text>
                    </Space>
                  </div>
                </Col>

                <Col span={12}>
                  <Text strong>基础价格:</Text>
                  <br />
                  <Text>${selectedService?.price}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>最终价格:</Text>
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
                        {showAdvancedOptions ? "收起" : "展开"} 高级选项
                        <Text type="secondary" style={{ marginLeft: "8px", fontSize: "12px" }}>
                          (运营商、转发、激活类型等可选配置)
                        </Text>
                      </Button>
                    </div>

                    {showAdvancedOptions && (
                      <Collapse defaultActiveKey={["1"]} ghost>
                        <Collapse.Panel header="基础选项" key="1">
                          <Space direction="vertical" style={{ width: "100%" }}>
                            {/* 转发选项 */}
                            <div>
                              <Text>转发选项:</Text>
                              <Space>
                                <Tag
                                  color={forward === 0 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setForward(0)}
                                >
                                  不转发 (0)
                                </Tag>
                                <Tag
                                  color={forward === 1 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setForward(1)}
                                >
                                  转发 (1)
                                </Tag>
                              </Space>
                            </div>

                            {/* 激活类型 */}
                            <div>
                              <Text>激活类型:</Text>
                              <Space>
                                <Tag
                                  color={activationType === 0 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setActivationType(0)}
                                >
                                  SMS (0)
                                </Tag>
                                <Tag
                                  color={activationType === 1 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setActivationType(1)}
                                >
                                  号码 (1)
                                </Tag>
                                <Tag
                                  color={activationType === 2 ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setActivationType(2)}
                                >
                                  语音 (2)
                                </Tag>
                              </Space>
                            </div>

                            {/* 语言选择 */}
                            <div>
                              <Text>语言:</Text>
                              <Space>
                                <Tag
                                  color={language === "en" ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setLanguage("en")}
                                >
                                  英语 (en)
                                </Tag>
                                <Tag
                                  color={language === "ru" ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setLanguage("ru")}
                                >
                                  俄语 (ru)
                                </Tag>
                                <Tag
                                  color={language === "cn" ? "blue" : "default"}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => setLanguage("cn")}
                                >
                                  中文 (cn)
                                </Tag>
                              </Space>
                            </div>

                            {/* 运营商选择 */}
                            {supportsOperatorSelection(selectedCountry!) && (
                              <div>
                                <Text>运营商选择:</Text>
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
                                      <Text type="secondary">正在加载运营商列表...</Text>
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
                                        {operator === "any" ? "任意运营商" : operator}
                                      </Tag>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </Space>
                        </Collapse.Panel>

                        <Collapse.Panel header="高级可选选项" key="2">
                          <Space direction="vertical" style={{ width: "100%" }}>
                            {/* 推荐ID */}
                            <div>
                              <Text>推荐ID:</Text>
                              <Input
                                value={ref}
                                onChange={(e) => setRef(e.target.value)}
                                placeholder="推荐ID (可选)"
                                style={{ width: "200px" }}
                              />
                              <Text type="secondary" style={{ fontSize: "12px" }}>
                                用于推荐系统追踪，通常留空
                              </Text>
                            </div>

                            {/* 电话号码排除 */}
                            <div>
                              <Text>电话号码排除:</Text>
                              <Input
                                value={phoneException}
                                onChange={(e) => setPhoneException(e.target.value)}
                                placeholder="例如: 7918,7900111 (俄罗斯号码前缀)"
                                style={{ width: "300px" }}
                              />
                              <Text type="secondary" style={{ fontSize: "12px" }}>
                                排除特定前缀的俄罗斯号码，用逗号分隔，通常留空
                              </Text>
                            </div>
                          </Space>
                        </Collapse.Panel>

                        <Collapse.Panel header="FreePrice 模式 (可选)" key="3">
                          <div>
                            <div style={{ marginBottom: "8px" }}>
                              <Text type="secondary">
                                设置最大价格，系统将为您找到最佳价格的号码
                              </Text>
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
                                {useFreePrice ? "启用" : "启用 FreePrice"}
                              </Button>
                              {useFreePrice && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <Text type="secondary">最大价格:</Text>
                                  <Input
                                    type="number"
                                    placeholder="输入最大价格"
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
                                  💡 系统将尝试找到价格不超过 {maxPrice} USD 的最佳号码
                                </Text>
                                <div style={{ marginTop: "4px" }}>
                                  <Text type="secondary" style={{ fontSize: "12px" }}>
                                    📊 当前单价: ${getFinalPrice()} | 最大价格: ${maxPrice}
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
                message="余额不足"
                description={`当前余额 $${
                  user?.balance?.toFixed(2) || "0.00"
                }，需要 $${getTotalPrice()}`}
                type="warning"
                showIcon
                style={{ marginBottom: "24px" }}
                action={
                  <Button size="small" onClick={() => navigate("/balance")}>
                    立即充值
                  </Button>
                }
              />
            )}

            {/* 服务说明 */}
            <Alert
              message="服务说明"
              description="选择确认后，系统将为您分配一个临时手机号码。您可以使用该号码接收短信验证码，服务完成后号码将被回收。"
              type="info"
              showIcon
              style={{ marginBottom: "24px" }}
            />

            {/* 订单详情 */}
            <Card size="small" style={{ marginBottom: "24px" }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">服务类型:</Text>
                  <br />
                  <Text>{selectedService?.category_cn || selectedService?.category}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">预计分配时间:</Text>
                  <br />
                  <Text>1-3 分钟</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">号码有效期:</Text>
                  <br />
                  <Text>20 分钟</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">支持服务:</Text>
                  <br />
                  <Text>{selectedService?.description || "短信验证码接收"}</Text>
                </Col>
              </Row>
            </Card>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <Space size="middle">
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
            )}

            {currentStep < 2 && (
              <Tooltip
                title={currentStep === 1 && !hasEnoughBalance() ? "余额不足，无法继续" : undefined}
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
                  下一步
                </Button>
              </Tooltip>
            )}

            {currentStep === 2 && (
              <Popconfirm
                title="确认订单"
                description={`确定要购买 ${
                  selectedService?.name_cn || selectedService?.name
                } 服务吗？将从您的账户扣除 $${getTotalPrice()}`}
                onConfirm={handleConfirmOrder}
                okText="确认"
                cancelText="取消"
                okButtonProps={{ loading: loading }}
              >
                <Button type="primary" size="large" disabled={!hasEnoughBalance()}>
                  {loading ? "正在处理..." : `确认订单 ($${getTotalPrice()})`}
                </Button>
              </Popconfirm>
            )}

            <Button onClick={handleReset}>重新选择</Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default GetNumberPage;
