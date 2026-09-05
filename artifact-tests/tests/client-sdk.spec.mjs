import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_CLIENT_VALUES } from "../helpers/bundles.mjs";
import { runBrowserSmoke } from "../helpers/browser.mjs";
import { createFixtureProject } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/client-sdk artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/client-sdk",
      fixture: "client-sdk",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("serves config values over streaming from the ESM entry in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "main.mjs" });
    expect(result, result.error).toEqual({ ok: true, values: { ready: true, ...EXPECTED_CLIENT_VALUES } });
  });

  test("serves config values over polling from the CJS entry in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "main-require.cjs" });
    expect(result, result.error).toEqual({ ok: true, values: { ready: true, ...EXPECTED_CLIENT_VALUES } });
  });
});
