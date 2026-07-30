import { describe, test, expect } from "vitest";
import { LimitedMap } from "../src/LimitedMap";

describe("LimitedMap", () => {
  test("behaves like a regular Map when under the limit", () => {
    const map = new LimitedMap<string, number>(3);

    map.set("a", 1);
    map.set("b", 2);

    expect(map.size).toBe(2);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.droppedCount).toBe(0);
  });

  test("removes the oldest key when the limit is reached", () => {
    const map = new LimitedMap<string, number>(3);

    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    map.set("d", 4);

    expect(map.size).toBe(3);
    expect(map.has("a")).toBe(false);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
    expect(map.get("d")).toBe(4);
    expect(map.droppedCount).toBe(1);
  });

  test("removes oldest keys in insertion order when multiple entries exceed the limit", () => {
    const map = new LimitedMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    map.set("d", 4);

    expect(map.size).toBe(2);
    expect(map.has("a")).toBe(false);
    expect(map.has("b")).toBe(false);
    expect(map.get("c")).toBe(3);
    expect(map.get("d")).toBe(4);
    expect(map.droppedCount).toBe(2);
  });

  test("accepts initial entries and enforces the limit on construction", () => {
    const map = new LimitedMap<string, number>(2, [
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    expect(map.size).toBe(2);
    expect(map.has("a")).toBe(false);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
    expect(map.droppedCount).toBe(1);
  });

  test("updating an existing key does not evict other entries beyond the limit", () => {
    const map = new LimitedMap<string, number>(3);

    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    map.set("a", 10);

    expect(map.size).toBe(3);
    expect(map.get("a")).toBe(10);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
    expect(map.droppedCount).toBe(0);
  });

  test("updating an existing key preserves its original insertion order for eviction", () => {
    const map = new LimitedMap<string, number>(3);

    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    map.set("a", 10); // update "a" — Map keeps its original position (oldest)
    map.set("d", 4); // should evict "a" since it remains the oldest key

    expect(map.size).toBe(3);
    expect(map.has("a")).toBe(false);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
    expect(map.get("d")).toBe(4);
    expect(map.droppedCount).toBe(1);
  });

  test("handles a limit of 1", () => {
    const map = new LimitedMap<string, number>(1);
    map.set("a", 1);
    map.set("b", 2);

    expect(map.size).toBe(1);
    expect(map.has("a")).toBe(false);
    expect(map.get("b")).toBe(2);
    expect(map.droppedCount).toBe(1);
  });

  describe("clearAndReset", () => {
    test("clears all elements and resets the droppedCount", () => {
      const map = new LimitedMap<string, number>(3);
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);
      map.set("d", 4);

      expect(map.size).toBe(3);
      expect(map.droppedCount).toBe(1);

      map.clearAndReset();

      expect(map.size).toBe(0);
      expect(map.droppedCount).toBe(0);
    });
  });
});
