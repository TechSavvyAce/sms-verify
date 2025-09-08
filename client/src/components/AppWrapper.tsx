import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import "dayjs/locale/en";
import { useLanguage } from "../contexts/LanguageContext";
import App from "../App";

const AppWrapper: React.FC = () => {
  const { currentLanguage } = useLanguage();

  // Set dayjs locale based on current language
  React.useEffect(() => {
    if (currentLanguage === "zh-CN") {
      dayjs.locale("zh-cn");
    } else {
      dayjs.locale("en");
    }
  }, [currentLanguage]);

  // Get Antd locale based on current language
  const antdLocale = currentLanguage === "zh-CN" ? zhCN : enUS;

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 8,
          fontSize: 14,
          fontFamily:
            currentLanguage === "zh-CN"
              ? "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
              : "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Layout: {
            headerBg: "#ffffff",
            bodyBg: "#f5f5f5",
            siderBg: "#ffffff",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "#e6f7ff",
            itemSelectedColor: "#1890ff",
          },
          Card: {
            borderRadiusLG: 12,
            paddingLG: 24,
          },
          Button: {
            borderRadius: 6,
            controlHeight: 40,
          },
          Input: {
            borderRadius: 6,
            controlHeight: 40,
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  );
};

export default AppWrapper;
