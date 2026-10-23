import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_CLIENT_VALUES, EXPECTED_TESTING_VALUES } from "../helpers/bundles.mjs";
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

  test("serves offline values from the ESM entry in a browser without a request", async () => {
    const requestsBefore = server.sdkRequests.length;

    const result = await runBrowserSmoke({ project, server, entry: "offline.mjs" });

    expect(result, result.error).toEqual({ ok: true, values: { ready: true, ...EXPECTED_CLIENT_VALUES } });
    expect(server.sdkRequests.slice(requestsBefore)).toEqual([]);
  });

  test("serves the last values with reason cached when the page reloads with the network blocked", async () => {
    const { firstLoad, reload } = await runBrowserSmoke({
      project,
      server,
      entry: "cached.mjs",
      reloadWithSdkRequestsBlocked: true,
    });

    expect(firstLoad, firstLoad.error).toEqual({
      ok: true,
      values: { ready: true, ...EXPECTED_CLIENT_VALUES },
      cachedValuesLoaded: false,
      reasons: { "welcome-message": "found-match", "feature-enabled": "found-match", "item-count": "found-match" },
    });
    expect(reload, reload.error).toEqual({
      ok: true,
      values: { ready: false, ...EXPECTED_CLIENT_VALUES },
      cachedValuesLoaded: true,
      reasons: { "welcome-message": "cached", "feature-enabled": "cached", "item-count": "cached" },
    });
  });

  test("serves test client values from the ESM testing entry in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "testing.mjs" });
    expect(result, result.error).toEqual({ ok: true, values: { ...EXPECTED_TESTING_VALUES } });
  });

  test("serves test client values from the CJS testing entry in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "testing-require.cjs" });
    expect(result, result.error).toEqual({ ok: true, values: { ...EXPECTED_TESTING_VALUES } });
  });
});
