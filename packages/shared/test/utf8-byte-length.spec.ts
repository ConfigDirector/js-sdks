import { describe, expect, test } from "vitest";
import { utf8ByteLength } from "../src/utf8-byte-length";

describe("utf8ByteLength", () => {
  test("counts one byte per ASCII character", () => {
    expect(utf8ByteLength("abc")).toBe(3);
  });

  test("counts two bytes for a character up to U+07FF", () => {
    expect(utf8ByteLength("é")).toBe(2);
  });

  test("counts three bytes for a character up to U+FFFF", () => {
    expect(utf8ByteLength("€")).toBe(3);
  });

  test("counts four bytes for a surrogate pair", () => {
    expect(utf8ByteLength("😀")).toBe(4);
  });

  test("counts three bytes for a lone high surrogate at the end", () => {
    expect(utf8ByteLength("\ud83d")).toBe(3);
  });

  test("counts a lone high surrogate and the two-byte character after it separately", () => {
    expect(utf8ByteLength("\ud83dé")).toBe(5);
  });

  test("matches the encoder on a mixed text", () => {
    const text = "size: 256 KB — ça marche 😀";

    expect(utf8ByteLength(text)).toBe(new TextEncoder().encode(text).byteLength);
  });
});
