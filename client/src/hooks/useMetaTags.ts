import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface MetaTags {
  title?: string;
  description?: string;
  keywords?: string;
  lang?: string;
}

export const useMetaTags = (metaTags: MetaTags) => {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Update document title
    if (metaTags.title) {
      document.title = metaTags.title;
    }

    // Update meta description
    if (metaTags.description) {
      updateMetaTag("description", metaTags.description);
    }

    // Update meta keywords
    if (metaTags.keywords) {
      updateMetaTag("keywords", metaTags.keywords);
    }

    // Update HTML lang attribute
    if (metaTags.lang) {
      document.documentElement.lang = metaTags.lang;
    }
  }, [metaTags.title, metaTags.description, metaTags.keywords, metaTags.lang]);

  // Update language-specific meta tags when language changes
  useEffect(() => {
    const currentLang = i18n.language;

    // Update HTML lang attribute based on current language
    if (currentLang === "zh-CN") {
      document.documentElement.lang = "zh-CN";
    } else if (currentLang === "en-US") {
      document.documentElement.lang = "en-US";
    }
  }, [i18n.language]);
};

const updateMetaTag = (name: string, content: string) => {
  let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;

  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.name = name;
    document.head.appendChild(metaTag);
  }

  metaTag.content = content;
};

export default useMetaTags;
