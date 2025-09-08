import React, { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

interface LanguageContextType {
  currentLanguage: string;
  changeLanguage: (language: string) => void;
  availableLanguages: Array<{
    code: string;
    name: string;
    nativeName: string;
    flag: string;
  }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  const availableLanguages = [
    {
      code: "zh-CN",
      name: "Chinese",
      nativeName: "简体中文",
      flag: "https://flagcdn.com/w20/cn.png",
    },
    {
      code: "en-US",
      name: "English",
      nativeName: "English",
      flag: "https://flagcdn.com/w20/us.png",
    },
  ];

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    setCurrentLanguage(language);

    // Update URL to include language prefix
    const pathname = location.pathname;

    // Remove existing language prefix if present
    const pathSegments = pathname.split("/").filter(Boolean);
    const hasLanguagePrefix = availableLanguages.some((lang) => lang.code === pathSegments[0]);

    let cleanPath = pathname;
    if (hasLanguagePrefix) {
      // Remove the first segment (language prefix) and reconstruct the path
      cleanPath = "/" + pathSegments.slice(1).join("/");
    }

    // Ensure cleanPath starts with / and doesn't end with /
    if (!cleanPath.startsWith("/")) {
      cleanPath = "/" + cleanPath;
    }
    if (cleanPath === "/") {
      cleanPath = "";
    }

    const newPath = `/${language}${cleanPath}`;
    console.log("Language change:", { pathname, cleanPath, newPath });
    navigate(newPath, { replace: true });
  };

  // Extract language from URL and set it
  useEffect(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const languageFromUrl = pathSegments[0];

    if (availableLanguages.some((lang) => lang.code === languageFromUrl)) {
      if (languageFromUrl !== currentLanguage) {
        console.log("Setting language from URL:", languageFromUrl);
        i18n.changeLanguage(languageFromUrl);
        setCurrentLanguage(languageFromUrl);
      }
    } else {
      // If no language in URL, redirect to default language
      const defaultLanguage = "zh-CN";
      const cleanPath = location.pathname === "/" ? "" : location.pathname;
      const newPath = `/${defaultLanguage}${cleanPath}`;
      console.log("No language in URL, redirecting to:", newPath);
      navigate(newPath, { replace: true });
    }
  }, [location.pathname, i18n, currentLanguage, navigate]);

  const value: LanguageContextType = {
    currentLanguage,
    changeLanguage,
    availableLanguages,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
