import React from "react";
import { useTranslation } from "react-i18next";
import useMetaTags from "../../hooks/useMetaTags";

const MetaTagsManager: React.FC = () => {
  const { t, i18n } = useTranslation();

  // Get meta tags based on current language
  const metaTags = {
    title: t("meta.title"),
    description: t("meta.description"),
    keywords: t("meta.keywords"),
    lang: i18n.language,
  };

  // Use the custom hook to update meta tags
  useMetaTags(metaTags);

  return null; // This component doesn't render anything
};

export default MetaTagsManager;
