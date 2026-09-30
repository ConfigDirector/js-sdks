import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

const packagesDir = fileURLToPath(new URL("..", import.meta.url));
const fixtureDir = fileURLToPath(new URL("./test/fixtures/configdirector", import.meta.url));

const alias = {
  "@js-client-core": `${packagesDir}js-client-core/src`,
  "@js-browser-client": `${packagesDir}js-browser-client/src`,
  "@js-server-sdk": `${packagesDir}js-server-sdk/src`,
  "@shared": `${packagesDir}shared/src`,
  "@eventsource": `${packagesDir}eventsource/src`,
  "@config-evaluator": `${packagesDir}config-evaluator/src`,
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          include: ["test/*.spec.ts"],
          globalSetup: ["./test/global-setup.ts"],
        },
      },
      await defineVitestProject({
        resolve: { alias },
        test: {
          name: "nuxt",
          environment: "nuxt",
          include: ["test/nuxt/**/*.spec.ts"],
          environmentOptions: {
            nuxt: {
              rootDir: fixtureDir,
              domEnvironment: "jsdom",
            },
          },
        },
      }),
    ],
  },
});
