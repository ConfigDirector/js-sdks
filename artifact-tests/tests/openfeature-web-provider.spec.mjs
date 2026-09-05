import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_CLIENT_VALUES } from "../helpers/bundles.mjs";
import { runBrowserSmoke } from "../helpers/browser.mjs";
import { createFixtureProject } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/openfeature-web-provider artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/openfeature-web-provider",
      dependencies: { "@openfeature/web-sdk": "^1.0.0" },
      fixture: "openfeature-web-provider",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("resolves flags through OpenFeature in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "main.mjs" });
    expect(result, result.error).toEqual({ ok: true, values: EXPECTED_CLIENT_VALUES });
  });
});
