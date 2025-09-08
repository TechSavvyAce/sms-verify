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

  // Additional effect to ensure meta tags are updated when language changes
  useEffect(() => {
    // Force update after a short delay to ensure i18n has loaded
    const timer = setTimeout(() => {
      console.log("MetaTagsManager - Force updating meta tags after language change");
      if (metaTags.title) document.title = metaTags.title;
      if (metaTags.description) {
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) {
          descMeta.setAttribute("content", metaTags.description);
        }
      }
      if (metaTags.keywords) {
        const keywordsMeta = document.querySelector('meta[name="keywords"]');
        if (keywordsMeta) {
          keywordsMeta.setAttribute("content", metaTags.keywords);
        }
      }
      if (metaTags.lang) {
        document.documentElement.lang = metaTags.lang;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentLanguage, metaTags]);

  return null; // This component doesn't render anything
};

export default MetaTagsManager;
