// ESLint 配置文件（ESLint v9 新格式）
// 适合新手使用的宽松规则，帮助发现常见错误

export default [
  {
    files: ["api/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node.js 全局变量
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        // Web API 全局变量（Node.js 18+ 支持）
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
      },
    },
    rules: {
      // 代码风格规则
      indent: ["error", 2], // 使用 2 空格缩进
      quotes: ["error", "double"], // 使用双引号
      semi: ["error", "always"], // 必须使用分号
      "linebreak-style": ["error", "unix"], // 使用 Unix 换行符

      // 错误检测规则
      "no-unused-vars": "warn", // 未使用的变量警告（不报错）
      "no-undef": "error", // 未定义的变量报错
      "no-console": "off", // 允许使用 console（方便调试）

      // 最佳实践
      "no-var": "error", // 禁止使用 var，使用 let/const
      "prefer-const": "warn", // 建议使用 const
      eqeqeq: ["error", "always"], // 必须使用 === 或 !==
    },
  },
];
