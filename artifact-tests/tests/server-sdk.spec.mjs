import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_SERVER_VALUES } from "../helpers/bundles.mjs";
import { createFixtureProject, parseReport } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/server-sdk artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/server-sdk",
      fixture: "server-sdk",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("serves config values over streaming from the ESM entry", async () => {
    const result = await project.runNode("smoke.mjs", {
      CONFIGDIRECTOR_BASE_URL: server.baseUrl,
      CONFIGDIRECTOR_CONNECTION_MODE: "streaming",
    });
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual({ ready: true, ...EXPECTED_SERVER_VALUES });
  });

  test("serves config values over polling from the CJS entry", async () => {
    const result = await project.runNode("smoke.cjs", {
      CONFIGDIRECTOR_BASE_URL: server.baseUrl,
      CONFIGDIRECTOR_CONNECTION_MODE: "polling",
    });
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual({ ready: true, ...EXPECTED_SERVER_VALUES });
  });
});
