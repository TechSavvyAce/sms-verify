import React from "react";

interface DebugErrorProps {
  error: any;
}

const DebugError: React.FC<DebugErrorProps> = ({ error }) => {
  // Helper function to safely render error objects
  const renderError = (err: any): React.ReactNode => {
    if (typeof err === "string") {
      return err;
    }

    if (typeof err === "object" && err !== null) {
      if (err.message) {
        return err.message;
      }

      if (err.error) {
        return renderError(err.error);
      }

      // If it's an object with specific keys, extract the message
      if (err.code || err.statusCode) {
        return `Error ${err.code || err.statusCode}: ${err.message || "Unknown error"}`;
      }

      // Fallback: stringify the object safely
      try {
        return JSON.stringify(err, null, 2);
      } catch {
        return "Error object (cannot stringify)";
      }
    }

    return String(err);
  };

  return (
    <div
      style={{
        padding: "8px",
        background: "#fff2f0",
        border: "1px solid #ffccc7",
        borderRadius: "4px",
        margin: "8px 0",
      }}
    >
      <strong>Error:</strong> {renderError(error)}
    </div>
  );
};

export default DebugError;
