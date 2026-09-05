import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
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
});
