import { describe, expect, test } from "vitest";
import { compactTelemetryValue } from "../../src/telemetry/utils";

const LONG_VALUE = "x".repeat(501);

describe("compactTelemetryValue", () => {
  test("keeps short non-json values inline", async () => {
    const result = await compactTelemetryValue({ value: "short" }, async () => "should-not-be-called");

    expect(result).toEqual({ value: "short" });
  });

  test("replaces long values with a generated value id", async () => {
    const result = await compactTelemetryValue({ value: LONG_VALUE }, async () => "generated-id");

    expect(result).toEqual({ valueId: "generated-id" });
  });

  test("replaces json values with a generated value id", async () => {
    const result = await compactTelemetryValue({ value: "{}", type: "json" }, async () => "generated-id");

    expect(result).toEqual({ valueId: "generated-id" });
  });

  describe("when the value id generator cannot produce an id", () => {
    test("omits the value id for long values instead of failing", async () => {
      const result = await compactTelemetryValue({ value: LONG_VALUE }, async () => undefined);

      expect(result).toEqual({ valueId: undefined });
    });

    test("omits the value id for json values instead of failing", async () => {
      const result = await compactTelemetryValue({ value: "{}", type: "json" }, async () => undefined);

      expect(result).toEqual({ valueId: undefined });
    });
  });
});
