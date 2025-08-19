import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import "./index.css";
import App from "./App";

// 设置 dayjs 中文语言
dayjs.locale("zh-cn");

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 8,
          fontSize: 14,
          fontFamily:
            "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
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
  </React.StrictMode>
);
