const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Proxy API requests to backend
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:3001",
      changeOrigin: true,
      secure: false,
      logLevel: "debug",
      onError: (err, req, res) => {
        console.log("Proxy Error:", err);
      },
    })
  );
};
