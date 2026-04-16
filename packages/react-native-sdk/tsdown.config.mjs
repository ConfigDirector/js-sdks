import { defineConfig } from "tsdown";
import replace from "@rollup/plugin-replace";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

export default defineConfig({
  entry: { "configdirector-react-native": "src/index.tsx" },
  format: { esm: { target: ["es2019"] } },
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  tsconfig: "tsconfig.build.json",
  plugins: [
    replace({
      __VERSION__: version,
      preventAssignment: true,
    }),
  ],
});
