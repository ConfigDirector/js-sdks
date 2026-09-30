import { describe, expect, test } from "vitest";
import { deepEqual } from "../src/deepEqual";

describe("deepEqual", () => {
  test("compares primitives by value", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(true, false)).toBe(false);
    expect(deepEqual(1, "1")).toBe(false);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  test("compares plain objects by their entries regardless of key order", () => {
    expect(deepEqual({ id: "u", traits: { plan: "pro", seats: 3 } }, { traits: { seats: 3, plan: "pro" }, id: "u" })).toBe(true);
    expect(deepEqual({ id: "u" }, { id: "v" })).toBe(false);
    expect(deepEqual({ id: "u" }, { id: "u", name: "x" })).toBe(false);
    expect(deepEqual({ id: "u", name: undefined }, { id: "u" })).toBe(false);
  });

  test("compares arrays element by element in order", () => {
    expect(deepEqual([1, [2, { a: 3 }]], [1, [2, { a: 3 }]])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
  });

  test("compares dates by their time", () => {
    expect(deepEqual(new Date(1000), new Date(1000))).toBe(true);
    expect(deepEqual(new Date(1000), new Date(2000))).toBe(false);
    expect(deepEqual(new Date(1000), 1000)).toBe(false);
  });

  test("treats objects of different classes as different", () => {
    expect(deepEqual(new Map(), {})).toBe(false);
    expect(deepEqual(new URL("https://a.test"), new URL("https://a.test"))).toBe(false);
  });
});
