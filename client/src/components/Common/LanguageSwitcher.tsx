import React from "react";
import { Dropdown, Button, Space } from "antd";
import { GlobalOutlined } from "@ant-design/icons";
import { useLanguage } from "../../contexts/LanguageContext";

interface LanguageSwitcherProps {
  size?: "small" | "middle" | "large";
  type?: "text" | "link" | "primary" | "default" | "dashed";
  showText?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  size = "middle",
  type = "text",
  showText = true,
}) => {
  const { currentLanguage, changeLanguage, availableLanguages } = useLanguage();

  const currentLang = availableLanguages.find((lang) => lang.code === currentLanguage);

  const menuItems = availableLanguages.map((lang) => ({
    key: lang.code,
    label: (
      <Space>
        <img
          src={lang.flag}
          alt={`${lang.name} flag`}
          style={{ width: 16, height: 12, objectFit: "cover" }}
        />
        <span>{lang.nativeName}</span>
      </Space>
    ),
    onClick: () => changeLanguage(lang.code),
  }));

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" arrow trigger={["click"]}>
      <Button
        type={type}
        size={size}
        icon={
          currentLang ? (
            <img
              src={currentLang.flag}
              alt={`${currentLang.name} flag`}
              style={{ width: 16, height: 12, objectFit: "cover" }}
            />
          ) : (
            <GlobalOutlined />
          )
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {showText && currentLang && (
          <Space size={4}>
            <span>{currentLang.nativeName}</span>
          </Space>
        )}
      </Button>
    </Dropdown>
  );
};

export default LanguageSwitcher;
