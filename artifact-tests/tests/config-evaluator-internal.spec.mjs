import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { createFixtureProject, parseReport } from "../helpers/fixture-project.mjs";

describe("@configdirector/config-evaluator-internal artifact", () => {
  let project;

  beforeAll(async () => {
    project = await createFixtureProject({
      packageName: "@configdirector/config-evaluator-internal",
      fixture: "config-evaluator-internal",
    });
  });

  afterAll(async () => {
    await project?.cleanup();
  });

  packagingTests(() => project);

  const expectedReport = () => ({
    version: JSON.parse(readFileSync(join(project.packageDir, "package.json"), "utf8")).version,
    bothConditionsMatch: "true",
    onlyThePlanMatches: "false",
    onlyTheVersionMatches: "false",
  });

  test("evaluates a two-condition rule from the ESM entry", async () => {
    const result = await project.runNode("smoke.mjs");
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual(expectedReport());
  });

  test("evaluates a two-condition rule from the CJS entry", async () => {
    const result = await project.runNode("smoke.cjs");
    expect(result.code, result.stderr).toBe(0);
    expect(parseReport(result.stdout)).toEqual(expectedReport());
  });
});
