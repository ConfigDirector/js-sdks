import { describe, test, expect } from "vitest";
import { admitContext } from "../src/context-kind";
import type { ConfigDirectorContext } from "../src/types";

const contextWithKind = (kind: unknown) => ({ id: "42", kind }) as ConfigDirectorContext;

describe("admitContext", () => {
  test("admits a context without a kind", () => {
    const context = { id: "42" };

    expect(admitContext(context)).toEqual({ outcome: "admitted", context });
  });

  test("admits a context whose kind is null", () => {
    const context = contextWithKind(null);

    expect(admitContext(context)).toEqual({ outcome: "admitted", context });
  });

  test("admits the absence of a context", () => {
    expect(admitContext(undefined)).toEqual({ outcome: "admitted", context: undefined });
  });

  test("admits a kind made of the first and last lowercase letters and digits, a dash and an underscore", () => {
    const context = contextWithKind("az09-_");

    expect(admitContext(context)).toEqual({ outcome: "admitted", context });
  });

  test("admits a kind of 64 characters", () => {
    const context = contextWithKind("d".repeat(64));

    expect(admitContext(context)).toEqual({ outcome: "admitted", context });
  });

  test("ignores a context whose kind has an uppercase letter", () => {
    expect(admitContext({ id: "42", kind: "Tenant" })).toEqual({
      outcome: "ignored",
      kindSample: "Tenant",
    });
  });

  test("ignores a context whose kind is empty", () => {
    expect(admitContext(contextWithKind(""))).toEqual({
      outcome: "ignored",
      kindSample: "",
    });
  });

  test("ignores a context whose kind has 65 characters", () => {
    expect(admitContext(contextWithKind("d".repeat(65)))).toEqual({
      outcome: "ignored",
      kindSample: "d".repeat(65),
    });
  });

  test("ignores a context whose kind has surrounding spaces", () => {
    expect(admitContext(contextWithKind(" tenant "))).toEqual({
      outcome: "ignored",
      kindSample: " tenant ",
    });
  });

  test("ignores a context whose kind has the character before 'a'", () => {
    expect(admitContext(contextWithKind("`"))).toEqual({
      outcome: "ignored",
      kindSample: "`",
    });
  });

  test("ignores a context whose kind has the character after 'z'", () => {
    expect(admitContext(contextWithKind("{"))).toEqual({
      outcome: "ignored",
      kindSample: "{",
    });
  });

  test("ignores a context whose kind has the character before '0'", () => {
    expect(admitContext(contextWithKind("/"))).toEqual({
      outcome: "ignored",
      kindSample: "/",
    });
  });

  test("ignores a context whose kind has the character after '9'", () => {
    expect(admitContext(contextWithKind(":"))).toEqual({
      outcome: "ignored",
      kindSample: ":",
    });
  });

  test("ignores a context whose kind is a number, sampling its string form", () => {
    expect(admitContext(contextWithKind(42))).toEqual({
      outcome: "ignored",
      kindSample: "42",
    });
  });

  test("ignores a context whose kind is an object that cannot be converted to a string", () => {
    expect(admitContext(contextWithKind(Object.create(null)))).toEqual({
      outcome: "ignored",
      kindSample: "[object Object]",
    });
  });

  test("samples the first 128 characters of a longer invalid kind", () => {
    expect(admitContext(contextWithKind("D".repeat(200)))).toEqual({
      outcome: "ignored",
      kindSample: "D".repeat(128),
    });
  });

  test("keeps a character written with two UTF-16 code units whole at the end of a sample", () => {
    expect(admitContext(contextWithKind(`${"D".repeat(127)}😀tail`))).toEqual({
      outcome: "ignored",
      kindSample: `${"D".repeat(127)}😀`,
    });
  });
});
