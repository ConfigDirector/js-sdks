import { afterAll, beforeAll, describe } from "vitest";
import { packagingTests } from "../helpers/artifact-checks.mjs";
import { createFixtureProject } from "../helpers/fixture-project.mjs";

describe("@configdirector/react-native-sdk artifact", () => {
  let project;

  beforeAll(async () => {
    project = await createFixtureProject({
      packageName: "@configdirector/react-native-sdk",
      dependencies: { react: "^19.2.0", "react-native": "^0.86.0" },
    });
  });

  afterAll(async () => {
    await project?.cleanup();
  });

  packagingTests(() => project, { ignoreConditions: ["source"] });
});
