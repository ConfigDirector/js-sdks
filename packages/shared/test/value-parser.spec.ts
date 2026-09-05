import { describe, expect, test } from "vitest";
import { parseConfigValue } from "../src/value-parser";
import type { ConfigState, ConfigType } from "../src/types";

const testValueId = "00000000-0000-0000-0000-000000000002";

const configState = (type: ConfigType, value: string | null | undefined): ConfigState => {
  return { id: "00000000-0000-0000-0000-000000000001", key: "test", type, value, valueId: testValueId };
};

enum StringBasedEnum {
  One = "one",
  Two = "two",
  Three = "three",
}

enum FloatEnum {
  One = 1.5,
  Two = 2.6,
  Three = 3.7,
}

enum DefaultEnum {
  One,
  Two,
  Three,
}

describe("value parser", () => {
  describe("string", () => {
    test("returns the value as a string when the config type is string and generic type is string", () => {
      expect(parseConfigValue(configState("string", "hello"), "Default")).toMatchObject({
        parsedValue: "hello",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("string", "  "), "Default")).toMatchObject({
        parsedValue: "  ",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    test("returns an empty string value as-is", () => {
      expect(parseConfigValue(configState("string", ""), "Default")).toMatchObject({
        parsedValue: "",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    test("returns the default value when the config value is missing", () => {
      expect(parseConfigValue(configState("string", undefined), "Default")).toMatchObject({
        parsedValue: "Default",
        parsedValueId: undefined,
        reason: "value-missing",
        requestedType: "string",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("string", null), "Default")).toMatchObject({
        parsedValue: "Default",
        parsedValueId: undefined,
        reason: "value-missing",
        requestedType: "string",
        usedDefault: true,
      });
    });
  });

  describe("integer", () => {
    test("parses as an integer when the config type is 'integer' and generic type is number", () => {
      expect(parseConfigValue(configState("integer", "500"), 10)).toMatchObject({
        parsedValue: 500,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("integer", "-100"), 10)).toMatchObject({
        parsedValue: -100,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("integer", "50.5"), 10)).toMatchObject({
        parsedValue: 50,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    test("uses the default when parsing an integer fails", () => {
      expect(parseConfigValue(configState("integer", ""), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("integer", null), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "value-missing",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("integer", "abc"), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("uses the default when the value has surrounding or trailing garbage", () => {
      for (const value of ["42abc", " 42", "42 ", "0x10", "1,000"]) {
        expect(parseConfigValue(configState("integer", value), 10)).toMatchObject({
          parsedValue: 10,
          parsedValueId: undefined,
          reason: "invalid-number",
          requestedType: "number",
          usedDefault: true,
        });
      }
    });

    test("parses exponent notation as its full numeric value", () => {
      expect(parseConfigValue(configState("integer", "1e3"), 10)).toMatchObject({
        parsedValue: 1000,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    test("returns a string when the generic type is string", () => {
      expect(parseConfigValue<string>(configState("integer", "50.5"), "10")).toMatchObject({
        parsedValue: "50.5",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });
  });

  describe("float", () => {
    test("parses as an integer when the config type is 'float' and generic type is number", () => {
      expect(parseConfigValue(configState("float", "50.34"), 10.2)).toMatchObject({
        parsedValue: 50.34,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("float", "-100.67"), 10.2)).toMatchObject({
        parsedValue: -100.67,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("float", ".5"), 10.2)).toMatchObject({
        parsedValue: 0.5,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    test("uses the default when parsing a float fails", () => {
      expect(parseConfigValue(configState("float", ""), 10.2)).toMatchObject({
        parsedValue: 10.2,
        parsedValueId: undefined,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("float", undefined), 10.2)).toMatchObject({
        parsedValue: 10.2,
        parsedValueId: undefined,
        reason: "value-missing",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("float", "abc"), 10.2)).toMatchObject({
        parsedValue: 10.2,
        parsedValueId: undefined,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("uses the default when the value has surrounding or trailing garbage", () => {
      for (const value of ["1.5abc", " 1.5", "1.5 ", "0x10", "1.2.3", "Infinity"]) {
        expect(parseConfigValue(configState("float", value), 10.2)).toMatchObject({
          parsedValue: 10.2,
          parsedValueId: undefined,
          reason: "invalid-number",
          requestedType: "number",
          usedDefault: true,
        });
      }
    });

    test("returns a string when the generic type is string", () => {
      expect(parseConfigValue<string>(configState("float", "50.5"), "10")).toMatchObject({
        parsedValue: "50.5",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });
  });

  describe("boolean", () => {
    test("returns a boolean when the config type is boolean and the generic type is boolean", () => {
      expect(parseConfigValue(configState("boolean", "true"), false)).toMatchObject({
        parsedValue: true,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("boolean", "TRUE"), false)).toMatchObject({
        parsedValue: true,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("boolean", "false"), true)).toMatchObject({
        parsedValue: false,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("boolean", "FALSE"), true)).toMatchObject({
        parsedValue: false,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
    });

    test("returns the default value when the boolean cannot be parsed", () => {
      expect(parseConfigValue(configState("boolean", ""), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("boolean", "foo"), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("boolean", "  false  "), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
    });
  });

  describe("enum", () => {
    test("returns the value as enum when the config value is enum and the generic type is string", () => {
      expect(
        parseConfigValue<StringBasedEnum>(configState("enum", "one"), StringBasedEnum.Two),
      ).toMatchObject({
        parsedValue: StringBasedEnum.One,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("enum", "two"), StringBasedEnum.One)).toMatchObject({
        parsedValue: StringBasedEnum.Two,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    test("returns the value as enum when the config value is enum and the generic type is number", () => {
      expect(parseConfigValue<DefaultEnum>(configState("enum", "0"), DefaultEnum.Two)).toMatchObject({
        parsedValue: DefaultEnum.One,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("enum", "2"), DefaultEnum.One)).toMatchObject({
        parsedValue: DefaultEnum.Three,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue<FloatEnum>(configState("enum", "1.5"), FloatEnum.Two)).toMatchObject({
        parsedValue: FloatEnum.One,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("enum", "3.7"), FloatEnum.One)).toMatchObject({
        parsedValue: FloatEnum.Three,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    test("returns the value as string or number when the config is enum and the value is not in the enum list", () => {
      expect(
        parseConfigValue<StringBasedEnum>(configState("enum", "other"), StringBasedEnum.Two),
      ).toMatchObject({
        parsedValue: "other",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
      expect(parseConfigValue<FloatEnum>(configState("enum", "10.54"), FloatEnum.One)).toMatchObject({
        parsedValue: 10.54,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });
  });

  describe("json", () => {
    test("returns the value as an object when the config type is json and generic type is object", () => {
      expect(
        parseConfigValue(configState("json", JSON.stringify({ data: "Hello" })), { otherData: "bye" }),
      ).toMatchObject({
        parsedValue: { data: "Hello" },
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "Object",
        usedDefault: false,
      });

      expect(
        parseConfigValue(configState("json", JSON.stringify(["Hello", "Hi"])), { otherData: "bye" }),
      ).toMatchObject({
        parsedValue: ["Hello", "Hi"],
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "Object",
        usedDefault: false,
      });

    });

    test("returns the default value when the JSON value is null and the generic type is object", () => {
      expect(parseConfigValue(configState("json", JSON.stringify(null)), { otherData: "bye" })).toMatchObject(
        {
          parsedValue: { otherData: "bye" },
          parsedValueId: undefined,
          reason: "type-mismatch",
          requestedType: "Object",
          usedDefault: true,
        },
      );
    });

    test("returns primitive JSON values when the generic type matches", () => {
      expect(parseConfigValue(configState("json", "true"), false)).toMatchObject({
        parsedValue: true,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
      expect(parseConfigValue(configState("json", "42.5"), 10)).toMatchObject({
        parsedValue: 42.5,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    test("returns the default value when the parsed JSON type does not match the generic type", () => {
      expect(parseConfigValue(configState("json", '{"a":1}'), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "number",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("json", "[1,2]"), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("json", "42"), { otherData: "bye" })).toMatchObject({
        parsedValue: { otherData: "bye" },
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "Object",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("json", '"hello"'), { otherData: "bye" })).toMatchObject({
        parsedValue: { otherData: "bye" },
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "Object",
        usedDefault: true,
      });
    });

    test("returns the value as an array when the config type is json and generic type is array", () => {
      expect(
        parseConfigValue(configState("json", JSON.stringify(["Hello", "Hi"])), [{ otherData: "bye" }]),
      ).toMatchObject({
        parsedValue: ["Hello", "Hi"],
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "Array",
        usedDefault: false,
      });
    });

    test("returns the value as a string when the config type is json and generic type is string", () => {
      expect(
        parseConfigValue(configState("json", JSON.stringify({ data: "Hello" })), "{ otherData: 'bye' }"),
      ).toMatchObject({
        parsedValue: '{"data":"Hello"}',
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    test("returns the default value when parsing the JSON string fails", () => {
      expect(
        parseConfigValue(configState("json", "{'data': 'bad json'"), { otherData: "bye" }),
      ).toMatchObject({
        parsedValue: { otherData: "bye" },
        parsedValueId: undefined,
        reason: "invalid-json",
        requestedType: "Object",
        usedDefault: true,
      });
    });

    test("treats an empty string as invalid JSON when the generic type is object", () => {
      expect(parseConfigValue(configState("json", ""), { otherData: "bye" })).toMatchObject({
        parsedValue: { otherData: "bye" },
        parsedValueId: undefined,
        reason: "invalid-json",
        requestedType: "Object",
        usedDefault: true,
      });
    });

    test("returns an empty string value as-is when the generic type is string", () => {
      expect(parseConfigValue(configState("json", ""), "default")).toMatchObject({
        parsedValue: "",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });
  });

  describe("type mismatches", () => {
    test("returns the default value when a 'string' config is requested as a number but cannot be parsed", () => {
      expect(parseConfigValue(configState("string", "not-a-number"), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("returns the default value when a 'string' config requested as a number has trailing garbage", () => {
      expect(parseConfigValue(configState("string", "42px"), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "invalid-number",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("returns the config value when a 'string' config is requested as a parseable number", () => {
      expect(parseConfigValue(configState("string", "500"), 10)).toMatchObject({
        parsedValue: 500,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "number",
        usedDefault: false,
      });
    });

    test("returns the default value when a 'string' config is requested as a boolean but cannot be parsed", () => {
      expect(parseConfigValue(configState("string", "not-a-boolean"), false)).toMatchObject({
        parsedValue: false,
        parsedValueId: undefined,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
    });

    test("returns the config value when a 'string' config is requested as a parseable boolean", () => {
      expect(parseConfigValue(configState("string", "true"), false)).toMatchObject({
        parsedValue: true,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
    });

    test("returns the config value when an 'enum' config is requested as a parseable boolean", () => {
      expect(parseConfigValue(configState("enum", "TRUE"), false)).toMatchObject({
        parsedValue: true,
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "boolean",
        usedDefault: false,
      });
    });

    test("returns the default value when an 'enum' config is requested as a boolean but cannot be parsed", () => {
      expect(parseConfigValue(configState("enum", "on"), false)).toMatchObject({
        parsedValue: false,
        parsedValueId: undefined,
        reason: "invalid-boolean",
        requestedType: "boolean",
        usedDefault: true,
      });
    });

    test("returns the default value when a numeric config is requested as a boolean", () => {
      expect(parseConfigValue(configState("integer", "42"), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("float", "1.5"), false)).toMatchObject({
        parsedValue: false,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "boolean",
        usedDefault: true,
      });
    });

    test("returns the default value when a 'url' config is requested as a boolean or number", () => {
      expect(parseConfigValue(configState("url", "https://example.com"), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "boolean",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("url", "https://example.com"), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("returns the default value when a 'boolean' config is requested as a number", () => {
      expect(parseConfigValue(configState("boolean", "true"), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("returns the default value when a 'boolean' config is requested as a bigint", () => {
      expect(parseConfigValue(configState("boolean", "true"), BigInt(10) as unknown as number)).toMatchObject({
        parsedValue: BigInt(10),
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "bigint",
        usedDefault: true,
      });
    });

    test("returns the default value when a non-json config is requested as an object", () => {
      for (const type of ["string", "boolean", "integer", "float", "enum", "url"] as const) {
        expect(parseConfigValue(configState(type, "some-value"), { otherData: "bye" })).toMatchObject({
          parsedValue: { otherData: "bye" },
          parsedValueId: undefined,
          reason: "type-mismatch",
          requestedType: "Object",
          usedDefault: true,
        });
      }
    });

    test("returns the default value when a non-json config is requested as an array", () => {
      expect(parseConfigValue(configState("string", "a,b,c"), ["a"])).toMatchObject({
        parsedValue: ["a"],
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "Array",
        usedDefault: true,
      });
    });

    test("returns the default value when a 'custom' config is requested as a non-string", () => {
      expect(parseConfigValue(configState("custom", "42"), 10)).toMatchObject({
        parsedValue: 10,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "number",
        usedDefault: true,
      });
    });

    test("returns the raw string for an unknown config type when the generic type is string", () => {
      expect(parseConfigValue(configState("something-new" as any, "veryfast"), "default")).toMatchObject({
        parsedValue: "veryfast",
        parsedValueId: testValueId,
        reason: "found-match",
        requestedType: "string",
        usedDefault: false,
      });
    });

    test("returns the default value for an unknown config type when the generic type is not string", () => {
      expect(parseConfigValue(configState("something-new" as any, "veryfast"), true)).toMatchObject({
        parsedValue: true,
        parsedValueId: undefined,
        reason: "type-mismatch",
        requestedType: "boolean",
        usedDefault: true,
      });
    });
  });
});
