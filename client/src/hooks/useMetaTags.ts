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

  // Clear any cached meta tags on mount
  useEffect(() => {
    console.log("useMetaTags - Clearing cached meta tags on mount");
    const existingDescription = document.querySelector('meta[name="description"]');
    const existingKeywords = document.querySelector('meta[name="keywords"]');

    if (existingDescription) {
      existingDescription.remove();
    }
    if (existingKeywords) {
      existingKeywords.remove();
    }
  }, []);

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

    // Force a re-render of meta tags by removing and re-adding them
    setTimeout(() => {
      forceUpdateMetaTags(metaTags);
    }, 200);

    // Additional immediate update for critical meta tags
    setTimeout(() => {
      console.log("useMetaTags - Immediate meta tag verification");
      const descMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      const keywordsMeta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;

      if (descMeta && metaTags.description) {
        console.log("useMetaTags - Current description:", descMeta.content);
        console.log("useMetaTags - Expected description:", metaTags.description);
        if (descMeta.content !== metaTags.description) {
          console.log("useMetaTags - Description mismatch, forcing update");
          descMeta.content = metaTags.description;
          descMeta.setAttribute("content", metaTags.description);
        }
      }

      if (keywordsMeta && metaTags.keywords) {
        console.log("useMetaTags - Current keywords:", keywordsMeta.content);
        console.log("useMetaTags - Expected keywords:", metaTags.keywords);
        if (keywordsMeta.content !== metaTags.keywords) {
          console.log("useMetaTags - Keywords mismatch, forcing update");
          keywordsMeta.content = metaTags.keywords;
          keywordsMeta.setAttribute("content", metaTags.keywords);
        }
      }
    }, 500);
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

const forceUpdateMetaTags = (metaTags: MetaTags) => {
  console.log("forceUpdateMetaTags - Force updating meta tags:", metaTags);

  // Remove existing meta tags
  const existingDescription = document.querySelector('meta[name="description"]');
  const existingKeywords = document.querySelector('meta[name="keywords"]');

  if (existingDescription) {
    existingDescription.remove();
  }
  if (existingKeywords) {
    existingKeywords.remove();
  }

  // Recreate meta tags
  if (metaTags.description) {
    const descMeta = document.createElement("meta");
    descMeta.name = "description";
    descMeta.content = metaTags.description;
    document.head.appendChild(descMeta);
    console.log("forceUpdateMetaTags - Recreated description:", metaTags.description);
  }

  if (metaTags.keywords) {
    const keywordsMeta = document.createElement("meta");
    keywordsMeta.name = "keywords";
    keywordsMeta.content = metaTags.keywords;
    document.head.appendChild(keywordsMeta);
    console.log("forceUpdateMetaTags - Recreated keywords:", metaTags.keywords);
  }
};

const updateMetaTag = (name: string, content: string) => {
  console.log(`updateMetaTag - Updating ${name} with:`, content);

  // Try to find existing meta tag
  let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;

  if (!metaTag) {
    console.log(`updateMetaTag - Creating new meta tag for ${name}`);
    metaTag = document.createElement("meta");
    metaTag.name = name;
    document.head.appendChild(metaTag);
  } else {
    console.log(`updateMetaTag - Found existing meta tag for ${name}`);
  }

  // Force update the content
  metaTag.setAttribute("content", content);
  metaTag.content = content;

  // Also try to update the property directly
  Object.defineProperty(metaTag, "content", {
    value: content,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  console.log(`updateMetaTag - Updated ${name} to:`, metaTag.content);

  // Verify the update worked
  setTimeout(() => {
    const verifyTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    console.log(`updateMetaTag - Verification: ${name} = "${verifyTag?.content}"`);
  }, 100);
};

export default useMetaTags;
