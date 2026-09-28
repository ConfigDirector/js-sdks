import { describe, expect, test } from "vitest";
import { resolvePollingInterval } from "../../src/transport/pollingInterval";

const defaults = { defaultSeconds: 60, minimumSeconds: 30 };

describe("resolvePollingInterval", () => {
  test("uses the default without a warning when nothing is configured", () => {
    expect(resolvePollingInterval(undefined, defaults)).toEqual({ seconds: 60, warning: undefined });
  });

  test("keeps a configured value above the minimum without a warning", () => {
    expect(resolvePollingInterval(45, defaults)).toEqual({ seconds: 45, warning: undefined });
  });

  test("keeps a configured value exactly at the minimum without a warning", () => {
    expect(resolvePollingInterval(30, defaults)).toEqual({ seconds: 30, warning: undefined });
  });

  test("raises a configured value below the minimum and describes it", () => {
    expect(resolvePollingInterval(10, defaults)).toEqual({
      seconds: 30,
      warning: "pollingInterval of 10 seconds is below the minimum of 30 seconds. Using 30 seconds.",
    });
  });

  test("raises zero to the minimum", () => {
    expect(resolvePollingInterval(0, defaults)).toEqual({
      seconds: 30,
      warning: "pollingInterval of 0 seconds is below the minimum of 30 seconds. Using 30 seconds.",
    });
  });

  test("raises a negative value to the minimum", () => {
    expect(resolvePollingInterval(-5, defaults)).toEqual({
      seconds: 30,
      warning: "pollingInterval of -5 seconds is below the minimum of 30 seconds. Using 30 seconds.",
    });
  });

  test("raises NaN to the minimum", () => {
    expect(resolvePollingInterval(Number.NaN, defaults)).toEqual({
      seconds: 30,
      warning: "pollingInterval of NaN seconds is below the minimum of 30 seconds. Using 30 seconds.",
    });
  });

  test("uses the given defaults rather than fixed numbers", () => {
    const serverDefaults = { defaultSeconds: 300, minimumSeconds: 60 };
    expect(resolvePollingInterval(undefined, serverDefaults)).toEqual({ seconds: 300, warning: undefined });
    expect(resolvePollingInterval(59, serverDefaults)).toEqual({
      seconds: 60,
      warning: "pollingInterval of 59 seconds is below the minimum of 60 seconds. Using 60 seconds.",
    });
  });
});
