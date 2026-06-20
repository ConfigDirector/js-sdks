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

    test("returns the default value when the config value is missing", () => {
      expect(parseConfigValue(configState("string", ""), "Default")).toMatchObject({
        parsedValue: "Default",
        parsedValueId: undefined,
        reason: "value-missing",
        requestedType: "string",
        usedDefault: true,
      });
      expect(parseConfigValue(configState("string", undefined), "Default")).toMatchObject({
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
        reason: "value-missing",
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
        reason: "value-missing",
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
        reason: "value-missing",
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

      expect(parseConfigValue(configState("json", JSON.stringify(null)), { otherData: "bye" })).toMatchObject(
        {
          parsedValue: null,
          parsedValueId: testValueId,
          reason: "found-match",
          requestedType: "Object",
          usedDefault: false,
        },
      );
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
  });
});
