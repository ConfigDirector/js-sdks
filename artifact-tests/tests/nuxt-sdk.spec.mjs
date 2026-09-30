import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { EXPECTED_TESTING_VALUES } from "../helpers/bundles.mjs";
import { createFixtureProject, parseReport } from "../helpers/fixture-project.mjs";

describe("@configdirector/nuxt-sdk artifact", () => {
  let project;

  beforeAll(async () => {
    project = await createFixtureProject({
      packageName: "@configdirector/nuxt-sdk",
      fixture: "nuxt-sdk",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
  });

  packagingTests(() => project, { allow: ["#app", "nitropack/runtime", "h3", "vue"] });

  test("exposes a Nuxt module function from the ESM entry", async () => {
    const result = await project.runNode("smoke.mjs");
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual({ defaultExportType: "function" });
  });

  test("serves a test client's values from the testing entry and installs it for the plugin", async () => {
    const result = await project.runNode("testing.mjs");
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual({ ...EXPECTED_TESTING_VALUES, installed: true, uninstalled: true });
  });
});
