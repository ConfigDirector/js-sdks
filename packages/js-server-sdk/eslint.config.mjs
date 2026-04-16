import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  { ignores: ["dist/*"] },
  tseslint.configs.strict,
  {
    plugins: { "@stylistic": stylistic },
    rules: {
      "@stylistic/quotes": ["warn", "double", { avoidEscape: true }],
      "@stylistic/comma-dangle": ["warn", "always-multiline"],
      "@stylistic/semi": ["warn", "always"],
      "@stylistic/no-trailing-spaces": "warn",
      "@typescript-eslint/no-unused-vars": ["warn"],
      "@typescript-eslint/no-explicit-any": ["off"],
      "@typescript-eslint/consistent-type-imports": ["warn"],
    },
  },
]);
