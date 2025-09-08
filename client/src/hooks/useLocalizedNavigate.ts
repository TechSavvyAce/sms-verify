import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Hook that provides navigation with automatic language prefix handling
 */
export const useLocalizedNavigate = () => {
  const navigate = useNavigate();
  const { currentLanguage } = useLanguage();

  const localizedNavigate = (path: string, options?: any) => {
    // Remove leading slash if present
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;

    // Construct the full path with language prefix
    const fullPath = `/${currentLanguage}/${cleanPath}`;

    console.log("Localized navigate:", { path, cleanPath, fullPath, currentLanguage });
    navigate(fullPath, options);
  };

  return localizedNavigate;
};
