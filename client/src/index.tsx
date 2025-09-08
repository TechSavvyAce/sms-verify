import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import "./index.css";
import { LanguageProvider } from "./contexts/LanguageContext";
import AppWrapper from "./components/AppWrapper";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <Router>
      <LanguageProvider>
        <AppWrapper />
      </LanguageProvider>
    </Router>
  </React.StrictMode>
);
