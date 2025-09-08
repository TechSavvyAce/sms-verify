import React, { useEffect, useState } from "react";

const MetaTagsDebugger: React.FC = () => {
  const [metaInfo, setMetaInfo] = useState({
    title: "",
    description: "",
    keywords: "",
    lang: "",
  });

  useEffect(() => {
    const updateMetaInfo = () => {
      const title = document.title;
      const descriptionMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
      const keywordsMeta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
      const lang = document.documentElement.lang;

      setMetaInfo({
        title,
        description: descriptionMeta?.content || "",
        keywords: keywordsMeta?.content || "",
        lang,
      });
    };

    // Update immediately
    updateMetaInfo();

    // Update every second for debugging
    const interval = setInterval(updateMetaInfo, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "12px",
        zIndex: 9999,
        maxWidth: "300px",
        fontFamily: "monospace",
      }}
    >
      <h4 style={{ margin: "0 0 10px 0", color: "#4CAF50" }}>Meta Tags Debug</h4>
      <div>
        <strong>Title:</strong> {metaInfo.title}
      </div>
      <div>
        <strong>Description:</strong> {metaInfo.description}
      </div>
      <div>
        <strong>Keywords:</strong> {metaInfo.keywords}
      </div>
      <div>
        <strong>Lang:</strong> {metaInfo.lang}
      </div>
    </div>
  );
};

export default MetaTagsDebugger;
