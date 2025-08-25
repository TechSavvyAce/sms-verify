const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

module.exports = function (app) {
  // Proxy API requests to backend
  app.use(
    "/api",
    createProxyMiddleware({
      target: process.env.REACT_APP_BACKEND_URL || "http://localhost:3001",
      changeOrigin: true,
      secure: false,
      logLevel: "debug",
      onError: (err, req, res) => {
        console.log("Proxy Error:", err);
      },
    })
  );
};
