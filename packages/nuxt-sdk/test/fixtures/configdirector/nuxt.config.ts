import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import MyModule from "../../../src/module";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Monorepo source path aliases required when the module's runtime plugins are loaded from
// source (not from the pre-built dist) during testing. tsdown normally resolves these at
// build time; here we mirror the same alias map for Vite (client) and Nitro (server).
const alias: Record<string, string> = {
  "@js-client-core": resolve(__dirname, "../../../../js-client-core/src"),
  "@js-browser-client": resolve(__dirname, "../../../../js-browser-client/src"),
  "@js-server-sdk": resolve(__dirname, "../../../../js-server-sdk/src"),
  "@shared": resolve(__dirname, "../../../../shared/src"),
  "@eventsource": resolve(__dirname, "../../../../eventsource/src"),
  "@config-evaluator": resolve(__dirname, "../../../../config-evaluator/src"),
};

export default defineNuxtConfig({
  modules: [MyModule],
  vite: { resolve: { alias } },
  nitro: { alias },
});
