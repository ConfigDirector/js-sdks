import { defineConfig } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          include: ["test/server/*.spec.ts"],
          environment: "node",
        },
      },
      await defineVitestProject({
        test: {
          name: "nuxt",
          include: ["test/nuxt/*.spec.ts"],
          environment: "nuxt",
          environmentOptions: {
            nuxt: { domEnvironment: "jsdom" },
          },
        },
      }),
    ],
  },
});
