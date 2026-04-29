// @ts-check
import { createConfigForNuxt } from "@nuxt/eslint-config/flat";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: {
      semi: true,
      quotes: "double",
      commaDangle: "always-multiline",
      arrowParens: true,
    },
  },
  dirs: {
    src: [
      "./playground",
    ],
  },
})
  .append([
    {
      files: ["src/**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
      plugins: { js },
      extends: ["js/recommended"],
      languageOptions: { globals: globals.browser },
    },
    { ignores: ["dist/*", "test/fixtures/**"] },
    {
      plugins: { "@stylistic": stylistic },
      rules: {
        "@stylistic/quotes": ["warn", "double", { avoidEscape: true }],
        "@stylistic/comma-dangle": ["warn", "always-multiline"],
        "@stylistic/semi": ["warn", "always"],
        "@stylistic/no-trailing-spaces": "warn",
        "@stylistic/operator-linebreak": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["warn"],
        "@typescript-eslint/no-explicit-any": ["off"],
      },
    },
    {
      files: ["**/*.{ts,mts,cts,tsx,vue}"],
      rules: {
        "@typescript-eslint/consistent-type-imports": ["warn"],
      },
    },
  ],
  );
