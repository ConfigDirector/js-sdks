import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_CLIENT_VALUES, EXPECTED_SERVER_VALUES } from "../helpers/bundles.mjs";
import { runBrowserSmoke } from "../helpers/browser.mjs";
import { createFixtureProject, parseReport } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/nextjs-sdk artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/nextjs-sdk",
      dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
      fixture: "nextjs-sdk",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("serves config values from the server ESM entry", async () => {
    const result = await project.runNode("smoke.mjs", {
      CONFIGDIRECTOR_BASE_URL: server.baseUrl,
      NEXT_RUNTIME: "nodejs",
    });
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual({ ready: true, ...EXPECTED_SERVER_VALUES });
  });

  test("serves config values from the server CJS entry", async () => {
    const result = await project.runNode("smoke.cjs", {
      CONFIGDIRECTOR_BASE_URL: server.baseUrl,
      NEXT_RUNTIME: "nodejs",
    });
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual({ ready: true, ...EXPECTED_SERVER_VALUES });
  });

  test("renders config values through the client provider in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "main.jsx" });
    expect(result, result.error).toEqual({ ok: true, values: EXPECTED_CLIENT_VALUES });
  });
});
