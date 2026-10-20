import { describe, expect, test } from "vitest";
import { nativeValueConfigState } from "../src/native-values";
import { ConfigDirectorValidationError } from "../src/errors";

describe("nativeValueConfigState", () => {
  test("wraps the encoded value in a config state with the given ids", () => {
    expect(nativeValueConfigState("test-config:new-checkout", "new-checkout", true, "test-value:new-checkout:1")).toEqual({
      id: "test-config:new-checkout",
      key: "new-checkout",
      type: "boolean",
      value: "true",
      valueId: "test-value:new-checkout:1",
    });
  });

  test("leaves the value id undefined when none is given", () => {
    expect(nativeValueConfigState("offline:k", "k", 1, undefined).valueId).toBeUndefined();
  });

  test("rejects an invalid value with the SDK's validation error", () => {
    expect(() => nativeValueConfigState("offline:k", "k", NaN, undefined)).toThrow(ConfigDirectorValidationError);
  });
});
