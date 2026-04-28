import { defineConfig } from "tsdown";
import replace from "@rollup/plugin-replace";
import * as fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
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

function copyDtsAsLegacy(...outDirs) {
  for (const outDir of outDirs) {
    for (const file of fs.readdirSync(outDir, { recursive: true })) {
      if (file.endsWith(".d.mts")) {
        const src = resolve(outDir, file);
        const dst = src.replace(/\.d\.mts$/, ".d.ts");
        fs.copyFileSync(src, dst);
      }
    }
  }
}

function writeModuleMeta() {
  return {
    name: "write-module-meta",
    closeBundle() {
      fs.mkdirSync("dist", { recursive: true });
      fs.writeFileSync(
        "dist/module.json",
        JSON.stringify(
          {
            name: pkg.name,
            configKey: "configdirector",
            compatibility: { nuxt: ">=4.0.0" },
            version: pkg.version,
          },
          null,
          2,
        ),
      );
    },
  };
}

export default defineConfig([
  {
    entry: { module: "src/module.ts" },
    format: "esm",
    outDir: "dist",
    clean: true,
    dts: true,
    deps: { neverBundle: ["@nuxt/kit", "@nuxt/schema", "nuxt", /^nuxt\//] },
    alias: localAlias,
    plugins: [writeModuleMeta()],
  },
  {
    entry: { "plugin.server": "src/runtime/plugin.server.ts" },
    format: "esm",
    outDir: "dist/runtime",
    dts: true,
    deps: { neverBundle: ["#app", /^#app\//, "vue", /^vue\//, "nuxt", /^nuxt\//, "nitropack", /^nitropack\//] },
    alias: localAlias,
    plugins: [
      replace({
        __VERSION__: pkg.version,
        preventAssignment: true,
      }),
    ],
  },
  {
    entry: { "plugin.client": "src/runtime/plugin.client.ts" },
    format: "esm",
    outDir: "dist/runtime",
    dts: true,
    deps: { neverBundle: ["#app", /^#app\//, "vue", /^vue\//, "nuxt", /^nuxt\//, "nitropack", /^nitropack\//] },
    alias: localAlias,
    plugins: [
      inlineWorkerPlugin(),
      replace({
        __VERSION__: pkg.version,
        preventAssignment: true,
      }),
    ],
  },
  {
    entry: {
      "app/composables/useClient": "src/runtime/app/composables/useClient.ts",
      "app/composables/useClientStatus": "src/runtime/app/composables/useClientStatus.ts",
      "app/composables/useContext": "src/runtime/app/composables/useContext.ts",
      "app/composables/useConfigValue": "src/runtime/app/composables/useConfigValue.ts",
      "nitro/plugin": "src/runtime/nitro/plugin.ts",
      "nitro/middleware": "src/runtime/nitro/middleware.ts",
    },
    format: "esm",
    outDir: "dist/runtime",
    dts: true,
    deps: { neverBundle: ["#app", /^#app\//, "vue", /^vue\//, "nuxt", /^nuxt\//, "nitropack", /^nitropack\//, "h3", "@configdirector/client-sdk"] },
    alias: localAlias,
    onSuccess() {
      copyDtsAsLegacy(
        resolve(__dirname, "dist/runtime/app/composables"),
        resolve(__dirname, "dist/runtime/nitro"),
      );
    },
  },
]);
