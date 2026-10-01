import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/web-sdk";
import { initConfigsTab } from "../src/configs-tab";
import { configValueText, renderSamplePage } from "./sample-page";

const sampleFlags = (values: { killSwitch: boolean; integer: number; json: { theme: string } }) =>
  ({
    "temporary-feature-flag": {
      variants: { configured: false },
      defaultVariant: "configured",
      disabled: false,
    },
    "permanent-kill-switch": {
      variants: { configured: values.killSwitch },
      defaultVariant: "configured",
      disabled: false,
    },
    "integer-config": {
      variants: { configured: values.integer },
      defaultVariant: "configured",
      disabled: false,
    },
    "day-of-the-week-config": {
      variants: { configured: "Monday" },
      defaultVariant: "configured",
      disabled: false,
    },
    "json-value-config": {
      variants: { configured: values.json },
      defaultVariant: "configured",
      disabled: false,
    },
  }) as const;

const SAMPLE_FLAGS = sampleFlags({ killSwitch: true, integer: 42, json: { theme: "dark" } });

describe("configs tab", () => {
  let provider: TypedInMemoryProvider;

  beforeEach(async () => {
    renderSamplePage();
    provider = new TypedInMemoryProvider(SAMPLE_FLAGS);
    await OpenFeature.setProviderAndWait(provider);
  });

  afterEach(async () => {
    await OpenFeature.clearProviders();
    OpenFeature.clearHandlers();
  });

  test("shows every flag value from the provider", () => {
    initConfigsTab(OpenFeature.getClient());

    expect(configValueText("temporary-feature-flag")).toBe("OFF");
    expect(configValueText("permanent-kill-switch")).toBe("ON");
    expect(configValueText("integer-config")).toBe("42");
    expect(configValueText("day-of-the-week-config")).toBe("Monday");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({ theme: "dark" });
  });

  test("shows the in-code default values for flags the provider does not know", async () => {
    await OpenFeature.setProviderAndWait(new TypedInMemoryProvider({}));

    initConfigsTab(OpenFeature.getClient());

    expect(configValueText("temporary-feature-flag")).toBe("ON");
    expect(configValueText("permanent-kill-switch")).toBe("OFF");
    expect(configValueText("integer-config")).toBe("10");
    expect(configValueText("day-of-the-week-config")).toBe("Friday");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({});
  });

  test("updates the cards of the flags a configuration change names", async () => {
    initConfigsTab(OpenFeature.getClient());

    await provider.putConfiguration(sampleFlags({ killSwitch: false, integer: 7, json: { theme: "light" } }));

    await vi.waitFor(() => expect(configValueText("permanent-kill-switch")).toBe("OFF"));
    expect(configValueText("integer-config")).toBe("7");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({ theme: "light" });
  });

  test("falls back to the in-code default value when a flag is removed", async () => {
    initConfigsTab(OpenFeature.getClient());

    const { "day-of-the-week-config": _removed, ...remainingFlags } = SAMPLE_FLAGS;
    await provider.putConfiguration(remainingFlags);

    await vi.waitFor(() => expect(configValueText("day-of-the-week-config")).toBe("Friday"));
    expect(configValueText("integer-config")).toBe("42");
  });
});
