import { defineConfig } from "tsdown";
import replace from "@rollup/plugin-replace";
import * as fs from "fs";
import { inlineWorkerPlugin } from "../../scripts/inline-worker-plugin.mjs";

export default defineConfig([
  {
    entry: {
      "configdirector-client": "src/index.ts",
    },
    minify: true,
    format: { "esm": { target: ["es2017"] }, "cjs": {} },
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: true,
    metafile: true,
    plugins: [
      inlineWorkerPlugin(),
      replace({
        __VERSION__: JSON.parse(fs.readFileSync("package.json", "utf8")).version,
        preventAssignment: true,
      }),
    ],
  },
]);
