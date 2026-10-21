import { beforeEach, describe, expect, test } from "vitest";
import { nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { createTestClient, installTestClient } from "@configdirector/nuxt-sdk/testing";
import ConfigsPage from "~/pages/index.vue";

const SAMPLE_VALUES = {
  "temporary-feature-flag": false,
  "permanent-kill-switch": true,
  "integer-config": 42,
  "day-of-the-week-config": "Monday",
  "json-value-config": { theme: "dark" },
};

// @nuxt/test-utils creates the Nuxt app once per test file, in a beforeAll hook, so the test client
// is installed at module level, before that, and its values are reset between tests.
const testClient = createTestClient({ values: SAMPLE_VALUES });
installTestClient(testClient);

type Page = Awaited<ReturnType<typeof mountSuspended>>;

const configValueText = (page: Page, key: string) =>
  page.find(`[data-config-key="${key}"]`).element.lastElementChild?.textContent;

describe("configs page", () => {
  beforeEach(async () => {
    testClient.replaceValues(SAMPLE_VALUES);
    await nextTick();
  });

  test("shows every config value from the client", async () => {
    const page = await mountSuspended(ConfigsPage);

    expect(configValueText(page, "temporary-feature-flag")).toBe("OFF");
    expect(configValueText(page, "permanent-kill-switch")).toBe("ON");
    expect(configValueText(page, "integer-config")).toBe("42");
    expect(configValueText(page, "day-of-the-week-config")).toBe("Monday");
    expect(JSON.parse(configValueText(page, "json-value-config")!)).toEqual({ theme: "dark" });
  });

  test("re-renders a card when its config changes", async () => {
    const page = await mountSuspended(ConfigsPage);

    testClient.setValue("permanent-kill-switch", false);
    testClient.setValue("integer-config", 7);
    await nextTick();

    expect(configValueText(page, "permanent-kill-switch")).toBe("OFF");
    expect(configValueText(page, "integer-config")).toBe("7");
  });

  test("falls back to the in-code default value when a config is removed", async () => {
    const page = await mountSuspended(ConfigsPage);

    testClient.removeValue("day-of-the-week-config");
    await nextTick();

    expect(configValueText(page, "day-of-the-week-config")).toBe("Friday");
    expect(configValueText(page, "integer-config")).toBe("42");
  });

  test("shows the in-code default values when no config is set", async () => {
    testClient.replaceValues({});
    const page = await mountSuspended(ConfigsPage);

    expect(configValueText(page, "temporary-feature-flag")).toBe("ON");
    expect(configValueText(page, "permanent-kill-switch")).toBe("OFF");
    expect(configValueText(page, "integer-config")).toBe("10");
    expect(configValueText(page, "day-of-the-week-config")).toBe("Friday");
    expect(JSON.parse(configValueText(page, "json-value-config")!)).toEqual({});
  });
});
