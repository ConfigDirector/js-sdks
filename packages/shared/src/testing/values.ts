import type { ConfigType } from "../types";
import { ConfigDirectorValidationError } from "../errors";

export type TestJsonValue = boolean | number | string | null | TestJsonValue[] | { [key: string]: TestJsonValue };

export type TestValue = boolean | number | string | TestJsonValue[] | { [key: string]: TestJsonValue };

export type TestValues = Record<string, TestValue>;

export type EncodedTestValue = { type: ConfigType; value: string };

export const encodeTestValue = (key: string, value: TestValue): EncodedTestValue => {
  if (key.trim().length == 0) {
    throw new ConfigDirectorValidationError("Invalid config key. The key of a test value cannot be empty.");
  }
  return encode(key, value);
};

const encode = (key: string, value: TestValue): EncodedTestValue => {
  switch (typeof value) {
    case "boolean":
      return { type: "boolean", value: value ? "true" : "false" };
    case "number":
      return encodeNumber(key, value);
    case "string":
      return { type: "string", value };
    case "object":
      if (value !== null) {
        assertJsonContents(key, value, "");
        return { type: "json", value: JSON.stringify(value) };
      }
  }
  throw new ConfigDirectorValidationError(
    `Invalid test value for '${key}': ${describe(value)}. Use a boolean, a number, a string, a plain object, or an array.`,
  );
};

const encodeNumber = (key: string, value: number): EncodedTestValue => {
  if (!Number.isFinite(value)) {
    throw new ConfigDirectorValidationError(`Invalid test value for '${key}': ${describe(value)} is not a finite number.`);
  }
  if (Number.isInteger(value)) {
    if (!Number.isSafeInteger(value)) {
      throw new ConfigDirectorValidationError(
        `Invalid test value for '${key}': ${value} is not a safe integer, so the SDK could not read it back exactly.`,
      );
    }
    return { type: "integer", value: String(value) };
  }
  return { type: "float", value: toPlainDecimal(value) };
};

const toPlainDecimal = (value: number): string => {
  const text = String(value);
  const exponentIndex = text.indexOf("e-");
  if (exponentIndex < 0) {
    return text;
  }
  const sign = text.startsWith("-") ? "-" : "";
  const [integerDigits = "", fractionDigits = ""] = text.slice(sign.length, exponentIndex).split(".");
  const leadingZeros = Number(text.slice(exponentIndex + 2)) - integerDigits.length;
  return `${sign}0.${"0".repeat(leadingZeros)}${integerDigits}${fractionDigits}`;
};

const assertJsonContents = (key: string, value: unknown, path: string): void => {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw invalidJsonContents(key, path, `${describe(value)} is not a finite number`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonContents(key, item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [property, item] of Object.entries(value)) {
      assertJsonContents(key, item, path ? `${path}.${property}` : property);
    }
    return;
  }
  throw invalidJsonContents(key, path, `${describe(value)} cannot be encoded as JSON`);
};

const invalidJsonContents = (key: string, path: string, problem: string) =>
  new ConfigDirectorValidationError(
    `Invalid test value for '${key}'${path ? ` at '${path}'` : ""}: ${problem}. JSON contents can hold booleans, finite numbers, strings, null, arrays, and plain objects.`,
  );

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const describe = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "function") {
    return "a function";
  }
  if (typeof value === "object") {
    return `a ${value.constructor?.name ?? "object"} instance`;
  }
  if (typeof value === "symbol") {
    return "a symbol";
  }
  return String(value);
};
