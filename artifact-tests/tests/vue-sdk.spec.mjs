import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_CLIENT_VALUES } from "../helpers/bundles.mjs";
import { runBrowserSmoke } from "../helpers/browser.mjs";
import { createFixtureProject } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/vue-sdk artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/vue-sdk",
      dependencies: { vue: "^3.5.0" },
      fixture: "vue-sdk",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("renders config values through the plugin and composables in a browser", async () => {
    const result = await runBrowserSmoke({
      project,
      server,
      entry: "main.mjs",
      define: {
        __VUE_OPTIONS_API__: "true",
        __VUE_PROD_DEVTOOLS__: "false",
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
      },
    });
    expect(result, result.error).toEqual({ ok: true, values: EXPECTED_CLIENT_VALUES });
  });
});
