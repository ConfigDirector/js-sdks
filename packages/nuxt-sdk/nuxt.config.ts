import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  typescript: {
    tsConfig: {
      compilerOptions: {
        rootDir: "../../",
        outDir: "./dist",
        paths: {
          "@eventsource/*": ["../../eventsource/src/*"],
          "@js-client-core/*": ["../../js-client-core/src/*"],
          "@js-browser-client/*": ["../../js-browser-client/src/*"],
          "@shared/*": ["../../shared/src/*"],
        },
      },
    },
  },
});
