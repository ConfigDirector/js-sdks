import { defineConfig } from "tsdown";
import replace from "@rollup/plugin-replace";
import * as fs from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inlineWorkerPlugin } from "../../scripts/inline-worker-plugin.mjs";

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

const versionReplace = replace({
  __VERSION__: pkg.version,
  preventAssignment: true,
});

export default defineConfig([
  {
    entry: { index: "src/server/index.ts" },
    outDir: "dist/server",
    format: { esm: { target: ["es2020"] }, cjs: {} },
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: true,
    minify: true,
    alias: localAlias,
    plugins: [versionReplace],
  },
  {
    entry: { index: "src/client/index.ts" },
    outDir: "dist/client",
    format: { esm: { target: ["es2017"] }, cjs: {} },
    splitting: false,
    sourcemap: false,
    dts: true,
    minify: true,
    alias: localAlias,
    // Next.js requires the "use client" directive at the top of the output file
    // to correctly identify this as a Client Components boundary.
    banner: { js: '"use client";' },
    plugins: [inlineWorkerPlugin(), versionReplace],
  },
]);
