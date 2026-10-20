import { describe, expect, test } from "vitest";
import { decodeNativeValue, encodeNativeValue } from "../src/native-values";
import { ConfigDirectorValidationError } from "../src/errors";

describe("encodeNativeValue", () => {
  test("encodes a boolean as a boolean config", () => {
    expect(encodeNativeValue("new-checkout", true)).toEqual({ type: "boolean", value: "true" });
    expect(encodeNativeValue("new-checkout", false).value).toBe("false");
  });

  test("encodes an integral number as an integer config", () => {
    expect(encodeNativeValue("max-items", 20)).toMatchObject({ type: "integer", value: "20" });
    expect(encodeNativeValue("max-items", 2.0)).toMatchObject({ type: "integer", value: "2" });
    expect(encodeNativeValue("max-items", -7)).toMatchObject({ type: "integer", value: "-7" });
  });

  test("encodes a non-integral number as a float config in plain notation", () => {
    expect(encodeNativeValue("ratio", 2.5)).toMatchObject({ type: "float", value: "2.5" });
    expect(encodeNativeValue("ratio", 1e-7)).toMatchObject({ type: "float", value: "0.0000001" });
    expect(encodeNativeValue("ratio", -0.000001234)).toMatchObject({ type: "float", value: "-0.000001234" });
  });

  test("encodes the largest safe integers in plain notation", () => {
    expect(encodeNativeValue("big", Number.MAX_SAFE_INTEGER)).toMatchObject({
      type: "integer",
      value: "9007199254740991",
    });
    expect(encodeNativeValue("big", Number.MIN_SAFE_INTEGER)).toMatchObject({
      type: "integer",
      value: "-9007199254740991",
    });
  });

  test("encodes a string as a string config, including an empty string", () => {
    expect(encodeNativeValue("greeting", "hello")).toMatchObject({ type: "string", value: "hello" });
    expect(encodeNativeValue("greeting", "")).toMatchObject({ type: "string", value: "" });
  });

  test("encodes objects and arrays as compact JSON in insertion order", () => {
    expect(encodeNativeValue("theme", { b: 1, a: [true, "x", null, { c: 2.5 }] })).toMatchObject({
      type: "json",
      value: '{"b":1,"a":[true,"x",null,{"c":2.5}]}',
    });
    expect(encodeNativeValue("list", [1, "two", null])).toMatchObject({ type: "json", value: '[1,"two",null]' });
    expect(encodeNativeValue("empty", {})).toMatchObject({ type: "json", value: "{}" });
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
    expect(() => encodeNativeValue("k", value as any)).toThrow(ConfigDirectorValidationError);
  });

  test.each(["", "   "])("rejects the key %p with a validation error", (key) => {
    expect(() => encodeNativeValue(key, true)).toThrow(ConfigDirectorValidationError);
  });

  test("names the key and the problem in the error message", () => {
    expect(() => encodeNativeValue("k", NaN)).toThrow("Invalid value for 'k'");
    expect(() => encodeNativeValue("k", 2 ** 53)).toThrow("safe integer");
  });

  test("names the key in the error message for an empty key", () => {
    expect(() => encodeNativeValue(" ", true)).toThrow("The key of a value cannot be empty.");
  });
});

describe("decodeNativeValue", () => {
  test("decodes a boolean config as a boolean", () => {
    expect(decodeNativeValue("boolean", "true")).toBe(true);
    expect(decodeNativeValue("boolean", "false")).toBe(false);
  });

  test("decodes an integer config as a number", () => {
    expect(decodeNativeValue("integer", "20")).toBe(20);
    expect(decodeNativeValue("integer", "-7")).toBe(-7);
  });

  test("decodes a float config as a number", () => {
    expect(decodeNativeValue("float", "2.5")).toBe(2.5);
    expect(decodeNativeValue("float", "0.0000001")).toBe(1e-7);
  });

  test("decodes a string config as the string itself, including an empty string", () => {
    expect(decodeNativeValue("string", "hello")).toBe("hello");
    expect(decodeNativeValue("string", "")).toBe("");
  });

  test("decodes a json config as the parsed object or array", () => {
    expect(decodeNativeValue("json", '{"b":1,"a":[true,"x",null,{"c":2.5}]}')).toEqual({
      b: 1,
      a: [true, "x", null, { c: 2.5 }],
    });
    expect(decodeNativeValue("json", "[1,2]")).toEqual([1, 2]);
  });

  test("decodes the enum, url and custom configs as the string they hold", () => {
    expect(decodeNativeValue("enum", "blue")).toBe("blue");
    expect(decodeNativeValue("url", "https://example.test/")).toBe("https://example.test/");
    expect(decodeNativeValue("custom", "raw")).toBe("raw");
  });
});
