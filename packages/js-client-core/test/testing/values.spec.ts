import { describe, expect, test } from "vitest";
import { encodeTestValue } from "../../src/testing/values";
import { ConfigDirectorValidationError } from "../../src/errors";

describe("encodeTestValue", () => {
  test("wraps the encoded value in a config state with generated ids", () => {
    expect(encodeTestValue("new-checkout", true, 1)).toEqual({
      id: "test-config:new-checkout",
      key: "new-checkout",
      type: "boolean",
      value: "true",
      valueId: "test-value:new-checkout:1",
    });
  });

  test("changes the value id with the revision", () => {
    expect(encodeTestValue("k", 1, 1).valueId).toBe("test-value:k:1");
    expect(encodeTestValue("k", 1, 2).valueId).toBe("test-value:k:2");
  });

  test("rejects an invalid value with the SDK's validation error", () => {
    expect(() => encodeTestValue("k", NaN, 1)).toThrow(ConfigDirectorValidationError);
  });
});
