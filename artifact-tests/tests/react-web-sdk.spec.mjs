import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_CLIENT_VALUES } from "../helpers/bundles.mjs";
import { runBrowserSmoke } from "../helpers/browser.mjs";
import { createFixtureProject } from "../helpers/fixture-project.mjs";
import { startMockServer } from "../helpers/mock-server.mjs";

describe("@configdirector/react-web-sdk artifact", () => {
  let server;
  let project;

  beforeAll(async () => {
    server = await startMockServer();
    project = await createFixtureProject({
      packageName: "@configdirector/react-web-sdk",
      dependencies: { react: "^19.2.0", "react-dom": "^19.2.0" },
      fixture: "react-web-sdk",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
    await server?.close();
  });

  packagingTests(() => project);

  test("renders config values through the provider and hooks in a browser", async () => {
    const result = await runBrowserSmoke({ project, server, entry: "main.jsx" });
    expect(result, result.error).toEqual({ ok: true, values: EXPECTED_CLIENT_VALUES });
  });
});
