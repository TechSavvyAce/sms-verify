import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../contexts/LanguageContext";
import useMetaTags from "../../hooks/useMetaTags";

const MetaTagsManager: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentLanguage } = useLanguage();

  // Get meta tags based on current language
  const metaTags = {
    title: t("meta.title"),
    description: t("meta.description"),
    keywords: t("meta.keywords"),
    lang: currentLanguage,
  };

  // Debug logging
  useEffect(() => {
    console.log("MetaTagsManager - Current language:", currentLanguage);
    console.log("MetaTagsManager - i18n language:", i18n.language);
    console.log("MetaTagsManager - Meta tags:", metaTags);
  }, [currentLanguage, i18n.language, metaTags]);

  // Use the custom hook to update meta tags
  useMetaTags(metaTags);

  return null; // This component doesn't render anything
};

export default MetaTagsManager;
