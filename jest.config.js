module.exports = {
  // 测试环境
  testEnvironment: "node",

  // 测试文件模式
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],

  // 覆盖率设置
  collectCoverage: true,
  collectCoverageFrom: [
    "routes/**/*.js",
    "services/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "models/**/*.js",
    "!models/index.js", // 排除模型索引文件
    "!**/__tests__/**",
    "!**/node_modules/**",
    "!coverage/**",
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },

  // 覆盖率报告格式
  coverageReporters: ["text", "text-summary", "html", "lcov"],

  // 设置文件
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // 模块路径映射
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  // 测试超时
  testTimeout: 30000,

  // 详细输出
  verbose: true,

  // 强制退出
  forceExit: true,

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 全局变量
  globals: {
    __DEV__: true,
  },
};
