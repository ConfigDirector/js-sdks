import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { encodeUtf8 } from "../src/utf8Encoder";

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("encodeUtf8 — Hermes path (TextEncoder available)", () => {
  test("encodes an ASCII string", () => {
    expect(decode(encodeUtf8("hello"))).toBe("hello");
  });

  test("encodes a multi-byte UTF-8 string", () => {
    const str = "café 日本語 🎉";
    expect(decode(encodeUtf8(str))).toBe(str);
  });

  test("encodes an empty string", () => {
    expect(encodeUtf8("")).toEqual(new Uint8Array([]));
  });
});

describe("encodeUtf8 — JSC fallback path (no TextEncoder)", () => {
  let savedTextEncoder: unknown;

  beforeEach(() => {
    savedTextEncoder = (globalThis as Record<string, unknown>)["TextEncoder"];
    delete (globalThis as Record<string, unknown>)["TextEncoder"];
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>)["TextEncoder"] = savedTextEncoder;
  });

  test("encodes an ASCII string", () => {
    expect(decode(encodeUtf8("hello"))).toBe("hello");
  });

  test("encodes a multi-byte UTF-8 string", () => {
    const str = "café 日本語 🎉";
    expect(decode(encodeUtf8(str))).toBe(str);
  });

  test("encodes an empty string", () => {
    expect(encodeUtf8("")).toEqual(new Uint8Array([]));
  });

  test("produces byte-identical output to TextEncoder for varied inputs", () => {
    const cases = ["simple", "über", "こんにちは", "emoji 🚀✨", "null\x00byte"];
    for (const str of cases) {
      const jscBytes = encodeUtf8(str);

      (globalThis as Record<string, unknown>)["TextEncoder"] = savedTextEncoder;
      const hermesBytes = encodeUtf8(str);
      delete (globalThis as Record<string, unknown>)["TextEncoder"];

      expect(Array.from(jscBytes)).toEqual(Array.from(hermesBytes));
    }
  });
});
