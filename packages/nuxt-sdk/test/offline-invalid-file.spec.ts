import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, fetch } from "@nuxt/test-utils/e2e";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));
const MISSING_FILE = fileURLToPath(new URL("./fixtures/configdirector/flags/typo.json", import.meta.url));

describe("ConfigDirector Nuxt SDK — offline cell whose values file does not exist", async () => {
  await setup({
    rootDir: FIXTURE_DIR,
    env: {
      NUXT_CONFIGDIRECTOR_CONNECTION_MODE: "offline",
      NUXT_CONFIGDIRECTOR_CONNECTION_FILE: MISSING_FILE,
      NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY: "",
      NUXT_CONFIGDIRECTOR_WAIT_FOR_INITIALIZATION: "false",
    },
  });

  test("fails every page request instead of rendering in-code default values, even with waitForInitialization off", async () => {
    const response = await fetch("/");
    const html = await response.text();

    expect(response.status).toBe(500);
    expect(html).not.toContain("default-message");
  });

  test("fails server routes instead of serving in-code default values", async () => {
    const response = await fetch("/api/config");
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("default-value");
  });
});
