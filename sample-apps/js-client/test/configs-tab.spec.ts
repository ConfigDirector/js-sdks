import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createTestClient } from "@configdirector/client-sdk/testing";
import type { TestClient } from "@configdirector/client-sdk/testing";
import { initConfigsTab } from "../src/configs-tab";
import { configValueText, renderSamplePage } from "./sample-page";

const SAMPLE_VALUES = {
  "temporary-feature-flag": false,
  "permanent-kill-switch": true,
  "integer-config": 42,
  "day-of-the-week-config": "Monday",
  "json-value-config": { theme: "dark" },
};

describe("configs tab", () => {
  let testClient: TestClient;

  beforeEach(() => {
    renderSamplePage();
    testClient = createTestClient({ values: SAMPLE_VALUES });
  });

  afterEach(() => testClient.client.dispose());

  test("shows every config value once the client is initialized", async () => {
    await testClient.client.initialize();
    initConfigsTab(testClient.client);

    expect(configValueText("temporary-feature-flag")).toBe("OFF");
    expect(configValueText("permanent-kill-switch")).toBe("ON");
    expect(configValueText("integer-config")).toBe("42");
    expect(configValueText("day-of-the-week-config")).toBe("Monday");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({ theme: "dark" });
  });

  test("shows the in-code default values when the client could not initialize", async () => {
    testClient.failInitialization();
    await testClient.client.initialize();
    initConfigsTab(testClient.client);

    expect(configValueText("temporary-feature-flag")).toBe("ON");
    expect(configValueText("permanent-kill-switch")).toBe("OFF");
    expect(configValueText("integer-config")).toBe("10");
    expect(configValueText("day-of-the-week-config")).toBe("Friday");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({});
  });

  test("updates a card when its config changes", async () => {
    await testClient.client.initialize();
    initConfigsTab(testClient.client);

    testClient.setValue("permanent-kill-switch", false);
    testClient.setValue("integer-config", 7);
    testClient.setValue("json-value-config", { theme: "light" });

    expect(configValueText("permanent-kill-switch")).toBe("OFF");
    expect(configValueText("integer-config")).toBe("7");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({ theme: "light" });
  });

  test("falls back to the in-code default value when a config is removed", async () => {
    await testClient.client.initialize();
    initConfigsTab(testClient.client);

    testClient.removeValue("day-of-the-week-config");

    expect(configValueText("day-of-the-week-config")).toBe("Friday");
    expect(configValueText("integer-config")).toBe("42");
  });
});
