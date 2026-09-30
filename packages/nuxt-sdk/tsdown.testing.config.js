import { defineConfig } from "tsdown";
import replace from "@rollup/plugin-replace";
import * as fs from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const localAlias = {
  "@js-client-core": resolve(__dirname, "../js-client-core/src"),
  "@js-browser-client": resolve(__dirname, "../js-browser-client/src"),
  "@js-server-sdk": resolve(__dirname, "../js-server-sdk/src"),
  "@shared": resolve(__dirname, "../shared/src"),
  "@eventsource": resolve(__dirname, "../eventsource/src"),
  "@config-evaluator": resolve(__dirname, "../config-evaluator/src"),
};

export default defineConfig({
  entry: { testing: "src/testing.ts" },
  format: "esm",
  outDir: "dist",
  clean: false,
  dts: true,
  alias: localAlias,
  plugins: [
    replace({
      __VERSION__: pkg.version,
      preventAssignment: true,
    }),
  ],
});
