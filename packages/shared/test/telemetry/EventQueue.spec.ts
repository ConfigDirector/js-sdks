import { afterEach, describe, expect, test, vi } from "vitest";
import { EventQueue } from "../../src/telemetry/EventQueue";

type TestEvent = {
  k: number;
};

describe("EventQueue", () => {
  test("drops older events when the limit is reached", () => {
    const queue = new EventQueue<TestEvent>(4);
    expect(queue.reachedLimit).toBe(false);
    expect(queue.droppedEventCount).toBe(0);

    queue.push({ k: 1 });
    queue.push({ k: 2 });
    queue.push({ k: 3 });
    queue.push({ k: 4 });
    expect(queue.events.map((e) => e.k)).toEqual([1, 2, 3, 4]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(0);

    queue.push({ k: 5 });
    expect(queue.events.map((e) => e.k)).toEqual([2, 3, 4, 5]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(1);

    queue.push({ k: 6 }, { k: 7 });
    expect(queue.events.map((e) => e.k)).toEqual([4, 5, 6, 7]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(3);
  });

  test("drops given events as well when they are over the limit", () => {
    const queue = new EventQueue<TestEvent>(4);

    queue.push({ k: 1 });
    queue.push({ k: 2 });
    queue.push({ k: 3 });
    expect(queue.events.map((e) => e.k)).toEqual([1, 2, 3]);
    expect(queue.reachedLimit).toBe(false);
    expect(queue.droppedEventCount).toBe(0);

    queue.push({ k: 4 }, { k: 5 }, { k: 6 }, { k: 7 }, { k: 8 });
    expect(queue.events.map((e) => e.k)).toEqual([5, 6, 7, 8]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(4);

    queue.push({ k: 9 }, { k: 10 }, { k: 11 }, { k: 12 }, { k: 13 });
    expect(queue.events.map((e) => e.k)).toEqual([10, 11, 12, 13]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(9);
  });

  test("handles too many events on an empty queue", () => {
    const queue = new EventQueue<TestEvent>(4);

    queue.push({ k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }, { k: 5 });
    expect(queue.events.map((e) => e.k)).toEqual([2, 3, 4, 5]);
    expect(queue.reachedLimit).toBe(true);
    expect(queue.droppedEventCount).toBe(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("takeSnapshot", () => {

    test("returns snapshot with current events and dropped count", () => {
      const queue = new EventQueue<TestEvent>(4);
      queue.push({ k: 1 }, { k: 2 }, { k: 3 });
      queue.push({ k: 4 }, { k: 5 }, { k: 6 });

      const snapshot = queue.takeSnapshot();

      expect(snapshot.events.map((e) => e.k)).toEqual([3, 4, 5, 6]);
      expect(snapshot.droppedCount).toBe(2);
    });

    test("resets queue state after snapshot", () => {
      const queue = new EventQueue<TestEvent>(4);
      queue.push({ k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }, { k: 5 });

      queue.takeSnapshot();

      expect(queue.events).toEqual([]);
      expect(queue.droppedEventCount).toBe(0);
      expect(queue.reachedLimit).toBe(false);
    });

    test("accumulates fresh state independently after a snapshot", () => {
      const queue = new EventQueue<TestEvent>(4);
      queue.push({ k: 1 }, { k: 2 });
      queue.takeSnapshot();

      queue.push({ k: 3 }, { k: 4 });
      const snapshot = queue.takeSnapshot();

      expect(snapshot.events.map((e) => e.k)).toEqual([3, 4]);
      expect(snapshot.droppedCount).toBe(0);
    });

    test("startTime reflects when the first event was pushed", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
      const queue = new EventQueue<TestEvent>(4);

      queue.push({ k: 1 });
      vi.advanceTimersByTime(5_000);
      const snapshot = queue.takeSnapshot();

      expect(snapshot.endTime.getTime() - snapshot.startTime.getTime()).toBe(5_000);
    });

    test("uses endTime as startTime when no events were pushed", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
      const queue = new EventQueue<TestEvent>(4);

      vi.advanceTimersByTime(5_000);
      const snapshot = queue.takeSnapshot();

      expect(snapshot.startTime).toEqual(snapshot.endTime);
      expect(snapshot.events).toEqual([]);
      expect(snapshot.droppedCount).toBe(0);
    });
  });

  describe("clear", () => {
    test("resets events, droppedEventCount, and startTime", () => {
      const queue = new EventQueue<TestEvent>(4);
      queue.push({ k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }, { k: 5 });
      expect(queue.droppedEventCount).toBe(1);

      queue.clear();

      expect(queue.events).toEqual([]);
      expect(queue.droppedEventCount).toBe(0);
      expect(queue.reachedLimit).toBe(false);

      // startTime should also be reset — a snapshot taken after clear uses endTime as startTime
      vi.useFakeTimers();
      vi.advanceTimersByTime(5_000);
      const snapshot = queue.takeSnapshot();
      expect(snapshot.startTime).toEqual(snapshot.endTime);
    });
  });
});
