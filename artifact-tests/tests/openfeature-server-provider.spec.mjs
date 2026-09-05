import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_SERVER_VALUES } from "../helpers/bundles.mjs";
import { createFixtureProject, parseReport } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/openfeature-server-provider artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/openfeature-server-provider",
      dependencies: { "@openfeature/server-sdk": "^1.23.0" },
      fixture: "openfeature-server-provider",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("resolves flags through OpenFeature from the ESM entry", async () => {
    const result = await project.runNode("smoke.mjs", { CONFIGDIRECTOR_BASE_URL: server.baseUrl });
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual(EXPECTED_SERVER_VALUES);
  });

  test("resolves flags through OpenFeature from the CJS entry", async () => {
    const result = await project.runNode("smoke.cjs", { CONFIGDIRECTOR_BASE_URL: server.baseUrl });
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual(EXPECTED_SERVER_VALUES);
  });
});
