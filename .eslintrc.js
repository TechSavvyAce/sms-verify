module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ["eslint:recommended", "prettier"],
  plugins: ["prettier"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    // Prettier integration
    "prettier/prettier": "error",

    // General rules
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],

    // Best practices
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-return-assign": "error",
    "no-self-compare": "error",
    "no-throw-literal": "error",
    "no-unmodified-loop-condition": "error",
    "no-useless-call": "error",
    "no-useless-concat": "error",
    "prefer-promise-reject-errors": "error",

    // Variables
    "no-catch-shadow": "off", // Deprecated in ESLint v5.1.0
    "no-shadow": "error",
    "no-shadow-restricted-names": "error",
    "no-undef-init": "error",
    "no-use-before-define": [
      "error",
      {
        functions: false,
        classes: true,
        variables: true,
      },
    ],

    // Stylistic issues (handled by Prettier, but some exceptions)
    "max-len": [
      "error",
      {
        code: 120,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    "no-multiple-empty-lines": ["error", { max: 2 }],
    "no-trailing-spaces": "error",

    // ES6
    "arrow-spacing": "error",
    "no-confusing-arrow": "error",
    "no-duplicate-imports": "error",
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-useless-rename": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-arrow-callback": "error",
    "prefer-const": "error",
    "prefer-destructuring": [
      "error",
      {
        object: true,
        array: false,
      },
    ],
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "error",

    // Node.js specific
    "callback-return": "error",
    "global-require": "error",
    "handle-callback-err": "error",
    "no-buffer-constructor": "error",
    "no-mixed-requires": "error",
    "no-new-require": "error",
    "no-path-concat": "error",
    "no-process-exit": "error",
    "no-sync": "warn",

    // Security
    "no-script-url": "error",
  },

  // Override rules for specific file patterns
  overrides: [
    {
      files: ["tests/**/*.js", "**/*.test.js", "**/*.spec.js"],
      env: {
        jest: true,
      },
      rules: {
        "no-console": "off",
        "global-require": "off",
      },
    },
    {
      files: ["scripts/**/*.js"],
      rules: {
        "no-console": "off",
        "no-process-exit": "off",
      },
    },
    {
      files: ["config/**/*.js"],
      rules: {
        "global-require": "off",
      },
    },
  ],

  // Global variables
  globals: {
    testHelpers: "readonly",
    logger: "readonly",
  },
};
