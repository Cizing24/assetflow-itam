import js from "@eslint/js";
import ts from "typescript-eslint";
import vue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier/flat";
export default ts.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".local/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: {
      "no-undef": "off",
      "vue/multi-word-component-names": "off",
      "vue/attributes-order": "off",
    },
  },
  {
    files: ["**/*.{ts,js,vue}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
);
