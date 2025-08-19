module.exports = {
  // 基本格式设置
  semi: true,
  trailingComma: "es5",
  singleQuote: false,
  doubleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // 括号设置
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",

  // 换行设置
  endOfLine: "lf",
  insertPragma: false,
  requirePragma: false,
  proseWrap: "preserve",

  // HTML/JSX 设置
  htmlWhitespaceSensitivity: "css",
  vueIndentScriptAndStyle: false,
  embeddedLanguageFormatting: "auto",

  // 文件覆盖设置
  overrides: [
    {
      files: "*.json",
      options: {
        printWidth: 120,
        trailingComma: "none",
      },
    },
    {
      files: "*.md",
      options: {
        proseWrap: "always",
        printWidth: 80,
      },
    },
    {
      files: "*.yml",
      options: {
        tabWidth: 2,
        singleQuote: true,
      },
    },
    {
      files: "*.yaml",
      options: {
        tabWidth: 2,
        singleQuote: true,
      },
    },
  ],
};
