import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { ClientTelemetryEventCollector } from "../../src/telemetry/ClientTelemetryEventCollector";
import type { EventReport } from "../../src/telemetry/types";
import { BASE_URL, TELEMETRY_URL, createStubbedLogger } from "../helpers";
import { defaultUrlFactory } from "@shared/url";
import type { EvaluatedConfigEvent } from "@shared/telemetry/telemetry-events";
import type { TelemetryValue } from "@shared/telemetry/utils";

const logger = createStubbedLogger();

const createCollector = (options: Record<string, unknown> = {}) =>
  new ClientTelemetryEventCollector({
    sdkKey: "sdk-key",
    sdkIdentity: {
      sdkName: "client-tests",
      sdkVersion: "1.0.1",
    },
    logger,
    baseUrl: new URL(BASE_URL),
    valueIdGenerator: async () => "value-id",
    urlFactory: defaultUrlFactory,
    ...options,
  });

const baseEvent: EvaluatedConfigEvent<TelemetryValue> = {
  contextId: "user-id",
  key: "my-config",
  type: "string" as const,
  defaultValue: { value: "default" },
  requestedType: "string",
  evaluatedValue: { value: "hello" },
  usedDefault: false,
  evaluationReason: "found-match" as const,
};

const waitForPayloadCount = async (count: number) => {
  await vi.waitFor(
    async () => {
      const payloads = await commands.mswGetPayloads();
      if (payloads.length < count) {
        throw new Error(`Expected ${count} payloads, got ${payloads.length}`);
      }
    },
    { timeout: 2_000, interval: 50 },
  );
};

/**
 * Waits ~100 ms of real time so any in-flight network responses can settle before a
 * "no payload received" assertion. vi.waitFor polls with real timers even while fake
 * timers are active, so this is safe inside fake-timer tests.
 */
const drainNetwork = () =>
  vi
    .waitFor(
      () => {
        throw new Error();
      },
      { timeout: 100, interval: 50 },
    )
    .catch(() => {});

beforeAll(async () => {
  await commands.mswSetup();
});

afterAll(async () => {
  await commands.mswTeardown();
});

describe("ClientTelemetryEventCollector", () => {
  let collector: ClientTelemetryEventCollector;

  beforeEach(async () => {
    vi.useFakeTimers();
    await commands.mswUseHandlers({ url: TELEMETRY_URL });
  });

  afterEach(async () => {
    await collector.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("evaluatedConfig", () => {
    test("sends queued events via fetch on flush", async () => {
      collector = createCollector();
      collector.evaluatedConfig(baseEvent);

      await vi.advanceTimersByTimeAsync(5_000);
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);
      const payload = payloads[0] as EventReport;
      expect(payload.clientSdkKey).toBe("sdk-key");
      expect(payload.metaContext.sdkName).toBe("client-tests");
      expect(payload.metaContext.sdkVersion).toBe("1.0.1");
      expect(payload.aggregatedEvents["evaluatedConfig"]).toHaveLength(1);
      expect(payload.aggregatedEvents["evaluatedConfig"][0]).toMatchObject({
        count: 1,
        event: expect.objectContaining({
          contextId: "user-id",
          key: "my-config",
          type: "string",
          evaluatedValue: { value: "hello" },
          evaluationReason: "found-match",
        }),
      });
    });

    test("does not send a request when there are no events", async () => {
      collector = createCollector();
      await vi.advanceTimersByTimeAsync(5_000);
      await drainNetwork();
      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(0);
    });

    test("aggregates duplicate events into a single entry with a count", async () => {
      collector = createCollector();
      collector.evaluatedConfig(baseEvent);
      collector.evaluatedConfig(baseEvent);
      collector.evaluatedConfig(baseEvent);

      await vi.advanceTimersByTimeAsync(5_000);
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect(payloads[0] as EventReport).toMatchObject({
        aggregatedEvents: { evaluatedConfig: [{ count: 3 }] },
      });
    });

    test("sends distinct events as separate aggregated entries", async () => {
      collector = createCollector();
      collector.evaluatedConfig({ ...baseEvent, key: "config-a", evaluatedValue: { value: "foo" } });
      collector.evaluatedConfig({ ...baseEvent, key: "config-b", evaluatedValue: { value: "bar" } });

      await vi.advanceTimersByTimeAsync(5_000);
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as EventReport).aggregatedEvents["evaluatedConfig"]).toHaveLength(2);
    });
  });

  describe("context", () => {
    test("includes the context in the payload after updateContext", async () => {
      collector = createCollector();
      await collector.updateContext({ id: "user-123", name: "Alice", traits: { plan: "pro" } });
      collector.evaluatedConfig(baseEvent);

      await vi.advanceTimersByTimeAsync(30_000);
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as EventReport).context).toEqual({
        id: "user-123",
        name: "Alice",
        traits: { plan: "pro" },
      });
    });

    test("sends no context when context has not been set", async () => {
      collector = createCollector();
      collector.evaluatedConfig(baseEvent);

      await vi.advanceTimersByTimeAsync(5_000);
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as EventReport).context).toBeUndefined();
    });

    test("flushes events queued before updateContext with the old context", async () => {
      collector = createCollector();
      collector.evaluatedConfig({ ...baseEvent, key: "pre-update-config" });

      await collector.updateContext({ id: "user-456" });
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);
      expect((payloads[0] as EventReport).context).toBeUndefined();
      expect((payloads[0] as EventReport).aggregatedEvents["evaluatedConfig"][0].event["key"]).toBe(
        "pre-update-config",
      );
    });

    test("flushes post-updateContext events with the new context", async () => {
      collector = createCollector();
      collector.evaluatedConfig({ ...baseEvent, key: "pre-update-config" });

      await collector.updateContext({ id: "user-456" });
      collector.evaluatedConfig({ ...baseEvent, key: "post-update-config" });

      await vi.advanceTimersByTimeAsync(30_000);
      await waitForPayloadCount(2);

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);
      expect((payloads[1] as EventReport).context).toEqual({ id: "user-456" });
      expect((payloads[1] as EventReport).aggregatedEvents["evaluatedConfig"][0].event["key"]).toBe(
        "post-update-config",
      );
    });

    test("resets the flush schedule after updateContext", async () => {
      collector = createCollector({ flushIntervalDelay: 10_000, initialFlushIntervalDelay: 5_000 });

      // Advance partway through the initial flush window, then update context
      await vi.advanceTimersByTimeAsync(3_000);
      await collector.updateContext({ id: "user-789" });

      // The original 5s timer was cancelled; the new interval is 10s
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(9_999);
      const payloadsBeforeFlush = await commands.mswGetPayloads();
      expect(payloadsBeforeFlush).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1);
      await waitForPayloadCount(1);

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);
    });
  });

  describe("flush interval", () => {
    test("re-schedules flushing after each interval", async () => {
      collector = createCollector({ flushIntervalDelay: 10_000, initialFlushIntervalDelay: 5_000 });

      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(5_000);
      await waitForPayloadCount(1);
      expect(await commands.mswGetPayloads()).toHaveLength(1);

      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(10_000);
      await waitForPayloadCount(2);
      expect(await commands.mswGetPayloads()).toHaveLength(2);
    });
  });

  describe("fatal error handling", () => {
    test("stops collecting events after a fatal 4xx response", async () => {
      await commands.mswUseHandlers({ url: TELEMETRY_URL, status: 400 });

      collector = createCollector();
      collector.evaluatedConfig(baseEvent);

      await vi.advanceTimersByTimeAsync(5_000);
      await vi.waitFor(
        async () => {
          if (!(await commands.mswWasRequestReceived())) throw new Error("Request not yet received");
        },
        { timeout: 2_000 },
      );
      expect(await commands.mswGetPayloads()).toHaveLength(0);

      // Further events should be silently dropped
      collector.evaluatedConfig({ ...baseEvent, key: "config-after-fatal" });
      await vi.advanceTimersByTimeAsync(35_000);
      await drainNetwork();
      expect(await commands.mswGetPayloads()).toHaveLength(0);
    });
  });

  describe("fetch error handling", () => {
    test("a TypeError stops collecting events", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      collector = createCollector();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(5_000);

      // Restore real network — but the collector should have halted after the fatal error
      vi.unstubAllGlobals();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(35_000);
      await drainNetwork();
      expect(await commands.mswGetPayloads()).toHaveLength(0);
    });

    test("a DOMException NotAllowedError stops collecting events", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Not allowed", "NotAllowedError")));

      collector = createCollector();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(5_000);

      vi.unstubAllGlobals();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(35_000);
      await drainNetwork();
      expect(await commands.mswGetPayloads()).toHaveLength(0);
    });

    test("a DOMException AbortError does not stop collecting events", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new DOMException("Aborted", "AbortError")));

      collector = createCollector();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(5_000);

      // Restore real network — the collector should still be active and send on the next interval
      vi.unstubAllGlobals();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(30_000);
      await waitForPayloadCount(1);
      expect(await commands.mswGetPayloads()).toHaveLength(1);
    });

    test("a generic Error does not stop collecting events", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Something went wrong")));

      collector = createCollector();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(5_000);

      vi.unstubAllGlobals();
      collector.evaluatedConfig(baseEvent);
      await vi.advanceTimersByTimeAsync(30_000);
      await waitForPayloadCount(1);
      expect(await commands.mswGetPayloads()).toHaveLength(1);
    });
  });

  describe("close", () => {
    test("flushes remaining events on close", async () => {
      collector = createCollector();
      collector.evaluatedConfig(baseEvent);

      await collector.close();
      await vi.advanceTimersByTimeAsync(0);
      await waitForPayloadCount(1);

      expect(await commands.mswGetPayloads()).toHaveLength(1);
    });

    test("stops collecting events after close", async () => {
      collector = createCollector();
      await collector.close();

      collector.evaluatedConfig(baseEvent);
      await drainNetwork();
      expect(await commands.mswGetPayloads()).toHaveLength(0);
    });
  });
});
