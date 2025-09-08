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
    console.log("useMetaTags - Updating meta tags:", metaTags);

    // Update document title
    if (metaTags.title) {
      console.log("useMetaTags - Setting title:", metaTags.title);
      document.title = metaTags.title;
    }

    // Update meta description
    if (metaTags.description) {
      console.log("useMetaTags - Setting description:", metaTags.description);
      updateMetaTag("description", metaTags.description);
    }

    // Update meta keywords
    if (metaTags.keywords) {
      console.log("useMetaTags - Setting keywords:", metaTags.keywords);
      updateMetaTag("keywords", metaTags.keywords);
    }

    // Update HTML lang attribute
    if (metaTags.lang) {
      console.log("useMetaTags - Setting lang:", metaTags.lang);
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
  console.log(`updateMetaTag - Updating ${name} with:`, content);

  let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;

  if (!metaTag) {
    console.log(`updateMetaTag - Creating new meta tag for ${name}`);
    metaTag = document.createElement("meta");
    metaTag.name = name;
    document.head.appendChild(metaTag);
  } else {
    console.log(`updateMetaTag - Found existing meta tag for ${name}`);
  }

  metaTag.content = content;
  console.log(`updateMetaTag - Updated ${name} to:`, metaTag.content);
};

export default useMetaTags;
