import { defineConfig } from "tsdown";
import replace from "@rollup/plugin-replace";
import * as fs from "fs";

export default defineConfig([
  {
    entry: {
      "configdirector-server": "src/index.ts",
    },
    minify: true,
    format: { "esm": { target: ["es2020"] }, "cjs": {} },
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: true,
    metafile: true,
    plugins: [
      replace({
        __VERSION__: JSON.parse(fs.readFileSync("package.json", "utf8")).version,
        preventAssignment: true,
      }),
    ],
  },
]);
