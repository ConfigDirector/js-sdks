import { describe, expect, test } from "vitest";
import { encodeTestValue } from "../../src/testing/values";
import { ConfigDirectorValidationError } from "../../src/errors";

describe("encodeTestValue", () => {
  test("encodes a boolean as a boolean config", () => {
    expect(encodeTestValue("new-checkout", true)).toEqual({ type: "boolean", value: "true" });
    expect(encodeTestValue("new-checkout", false).value).toBe("false");
  });

  test("encodes an integral number as an integer config", () => {
    expect(encodeTestValue("max-items", 20)).toMatchObject({ type: "integer", value: "20" });
    expect(encodeTestValue("max-items", 2.0)).toMatchObject({ type: "integer", value: "2" });
    expect(encodeTestValue("max-items", -7)).toMatchObject({ type: "integer", value: "-7" });
  });

  test("encodes a non-integral number as a float config in plain notation", () => {
    expect(encodeTestValue("ratio", 2.5)).toMatchObject({ type: "float", value: "2.5" });
    expect(encodeTestValue("ratio", 1e-7)).toMatchObject({ type: "float", value: "0.0000001" });
    expect(encodeTestValue("ratio", -0.000001234)).toMatchObject({ type: "float", value: "-0.000001234" });
  });

  test("encodes the largest safe integers in plain notation", () => {
    expect(encodeTestValue("big", Number.MAX_SAFE_INTEGER)).toMatchObject({
      type: "integer",
      value: "9007199254740991",
    });
    expect(encodeTestValue("big", Number.MIN_SAFE_INTEGER)).toMatchObject({
      type: "integer",
      value: "-9007199254740991",
    });
  });

  test("encodes a string as a string config, including an empty string", () => {
    expect(encodeTestValue("greeting", "hello")).toMatchObject({ type: "string", value: "hello" });
    expect(encodeTestValue("greeting", "")).toMatchObject({ type: "string", value: "" });
  });

  test("encodes objects and arrays as compact JSON in insertion order", () => {
    expect(encodeTestValue("theme", { b: 1, a: [true, "x", null, { c: 2.5 }] })).toMatchObject({
      type: "json",
      value: '{"b":1,"a":[true,"x",null,{"c":2.5}]}',
    });
    expect(encodeTestValue("list", [1, "two", null])).toMatchObject({ type: "json", value: '[1,"two",null]' });
    expect(encodeTestValue("empty", {})).toMatchObject({ type: "json", value: "{}" });
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a function", () => 1],
    ["a bigint", BigInt(1)],
    ["a symbol", Symbol("s")],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["an unsafe integer", 2 ** 53],
    ["a Date", new Date(0)],
    ["a Map", new Map()],
    ["a URL instance", new URL("https://example.com")],
    ["an object holding a function", { run: () => 1 }],
    ["an object holding undefined", { missing: undefined }],
    ["an object holding a bigint", { big: BigInt(1) }],
    ["an array holding NaN", [NaN]],
    ["a nested Date", { at: new Date(0) }],
  ])("rejects %s with a validation error", (_description, value) => {
    expect(() => encodeTestValue("k", value as any)).toThrow(ConfigDirectorValidationError);
  });

  test.each(["", "   "])("rejects the key %p with a validation error", (key) => {
    expect(() => encodeTestValue(key, true)).toThrow(ConfigDirectorValidationError);
  });

  test("names the key and the problem in the error message", () => {
    expect(() => encodeTestValue("k", NaN)).toThrow("'k'");
    expect(() => encodeTestValue("k", 2 ** 53)).toThrow("safe integer");
  });
});
