import { afterAll, beforeAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { WebWorkerTelemetryClient } from "../../src/telemetry/WebWorkerTelemetryClient";
import type { EventReport } from "@js-client-core/telemetry/types";
import { BASE_URL, TELEMETRY_URL, createStubbedLogger, sleep } from "../helpers";
import type { ConfigType, ConfigValueType } from "@shared/types";
import { defaultUrlFactory } from "@shared/url";
import { generateValueId } from "@shared/value-id-generator";

const logger = createStubbedLogger();

// Web Workers run in a separate JS context with real timers — vi.useFakeTimers() does
// not affect them. Use short real intervals so tests complete without fake timer control.
const INITIAL_FLUSH_DELAY = 200;
const FLUSH_DELAY = 800;
const IMMEDIATE_FLUSH_THRESHOLD = 200;
const createClient = (options: Record<string, unknown> = {}) =>
  new WebWorkerTelemetryClient({
    sdkKey: "sdk-key",
    logger,
    baseUrl: new URL(BASE_URL),
    initialFlushIntervalDelay: INITIAL_FLUSH_DELAY,
    flushIntervalDelay: FLUSH_DELAY,
    urlFactory: defaultUrlFactory,
    valueIdGenerator: generateValueId,
    ...options,
  });

const baseEvent = {
  contextId: "user-id",
  key: "my-config",
  type: "string" as const,
  defaultValue: "default",
  requestedType: "string",
  evaluatedValue: "hello",
  evaluatedValueId: "1MoOW7eqAPjhZeoELVwO9G",
  usedDefault: false,
  evaluationReason: "found-match" as const,
};

const waitForPayloadCount = async (count: number) => {
  const startTime = new Date().getTime();
  await vi.waitFor(
    async () => {
      const payloads = await commands.mswGetPayloads();
      if (payloads.length < count) {
        throw new Error(`Expected ${count} payloads, got ${payloads.length}`);
      }
    },
    { timeout: 2_000, interval: 50 },
  );
  return new Date().getTime() - startTime;
};

beforeAll(async () => {
  await commands.mswSetup();
});

afterAll(async () => {
  await commands.mswTeardown();
});

describe("TelemetryClient", () => {
  let client: WebWorkerTelemetryClient;

  beforeEach(async () => {
    await commands.mswUseHandlers({ url: TELEMETRY_URL });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await client.close();
  });

  describe("evaluatedConfig", () => {
    test("sanitizes JSON config values by replacing them with a hash", async () => {
      client = createClient();
      client.evaluatedConfig({
        key: "json-config",
        type: "json",
        defaultValue: { foo: "bar" },
        requestedType: "json",
        evaluatedValue: { baz: 42 },
        usedDefault: false,
        evaluationReason: "found-match",
      });

      await waitForPayloadCount(1);
      const payloads = await commands.mswGetPayloads();
      const event = (payloads[0] as EventReport).aggregatedEvents["evaluatedConfig"][0].event;
      expect(event["evaluatedValue"]["valueId"]).toMatch(/^[0-9a-zA-Z]{22}$/);
      expect(event["defaultValue"]["valueId"]).toMatch(/^[0-9a-zA-Z]{22}$/);
    });

    test("computes a valueId instead of [object Object] for object values when type is not provided", async () => {
      client = createClient();
      client.evaluatedConfig({
        key: "json-config",
        defaultValue: { threshold: 0.5 },
        requestedType: "object",
        evaluatedValue: { enabled: true, threshold: 0.8 },
        usedDefault: false,
        evaluationReason: "config-state-missing",
      });

      await waitForPayloadCount(1);
      const payloads = await commands.mswGetPayloads();
      const event = (payloads[0] as EventReport).aggregatedEvents["evaluatedConfig"][0].event;
      expect(event["defaultValue"]["valueId"]).toMatch(/^[0-9a-zA-Z]{22}$/);
      expect(event["evaluatedValue"]["valueId"]).toMatch(/^[0-9a-zA-Z]{22}$/);
    });

    test.each`
      type        | defaultValue                   | evaluatedValue
      ${"string"} | ${"default"}                   | ${"hello"}
      ${"url"}    | ${new URL("http://localhost")} | ${new URL("http://production")}
    `(
      "it flushes config evaluation events through the worker",
      async ({
        type,
        defaultValue,
        evaluatedValue,
      }: {
        type: ConfigType;
        defaultValue: ConfigValueType;
        evaluatedValue: ConfigValueType;
      }) => {
        client = createClient();

        client.evaluatedConfig({ ...baseEvent, type, defaultValue, evaluatedValue });

        await waitForPayloadCount(1);

        const payloads = await commands.mswGetPayloads();
        expect(payloads).toHaveLength(1);
        const payload = payloads[0] as EventReport;

        expect(payload.clientSdkKey).toBe("sdk-key");
        expect(payload.context).toBeUndefined();
        expect(payload.aggregatedEvents["evaluatedConfig"]).toHaveLength(1);
        expect(payload.aggregatedEvents["evaluatedConfig"][0]).toMatchObject({
          count: 1,
          event: expect.objectContaining({
            contextId: "user-id",
            key: "my-config",
            type,
            evaluatedValue: { value: evaluatedValue.toString() },
            defaultValue: { value: defaultValue.toString() },
            evaluationReason: "found-match",
          }),
        });
      },
    );
  });

  describe("updateContext", () => {
    test("it flushes the events when the context is updated", async () => {
      client = createClient();

      client.evaluatedConfig(baseEvent);
      client.updateContext({ id: "new-user-id" });
      await waitForPayloadCount(1);

      let payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);
      expect((payloads[0] as EventReport).context).toBeUndefined();

      client.evaluatedConfig({ ...baseEvent, contextId: "new-user-id" });
      await waitForPayloadCount(2);
      payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);

      const payload = payloads[1] as EventReport;
      expect(payload.context).toMatchObject({ id: "new-user-id" });
      expect(payload.aggregatedEvents["evaluatedConfig"]).toHaveLength(1);
      expect(payload.aggregatedEvents["evaluatedConfig"][0]).toMatchObject({
        count: 1,
        event: expect.objectContaining({
          contextId: "new-user-id",
        }),
      });
    });
  });

  describe("visibilitychange", () => {
    // Synchronize with the initial flush by adding an event and waiting for it to be
    // captured, then resetting payloads.
    const skipInitialFlush = async () => {
      client.evaluatedConfig(baseEvent);
      await waitForPayloadCount(1);
      await commands.mswUseHandlers({ url: TELEMETRY_URL });
    };

    test("it flushes the events when the document becomes hidden", async () => {
      client = createClient();
      await skipInitialFlush();

      client.evaluatedConfig(baseEvent);
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      const delay = await waitForPayloadCount(1);

      expect(delay).toBeLessThan(IMMEDIATE_FLUSH_THRESHOLD);

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);
      const payload = payloads[0] as EventReport;

      expect(payload.aggregatedEvents["evaluatedConfig"][0]).toMatchObject({
        count: 1,
        event: expect.objectContaining({
          contextId: baseEvent.contextId,
          key: baseEvent.key,
          evaluatedValue: { value: baseEvent.evaluatedValue },
        }),
      });
    });

    test("it does not flush when the document becomes visible again", async () => {
      client = createClient();
      await skipInitialFlush();

      client.evaluatedConfig(baseEvent);
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));

      // Verify the event is NOT flushed immediately by the visibilitychange
      await sleep(IMMEDIATE_FLUSH_THRESHOLD);
      expect(await commands.mswGetPayloads()).toHaveLength(0);

      // Verify it IS flushed by the regular interval
      await waitForPayloadCount(1);
      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);
      const payload = payloads[0] as EventReport;

      expect(payload.aggregatedEvents["evaluatedConfig"][0]).toMatchObject({
        count: 1,
        event: expect.objectContaining({
          contextId: baseEvent.contextId,
          key: baseEvent.key,
          evaluatedValue: { value: baseEvent.evaluatedValue },
        }),
      });
    });
  });

  describe("close", () => {
    test("it flushes the queued events and stops collecting", async () => {
      client = createClient();

      client.evaluatedConfig(baseEvent);
      await client.close();
      const delay = await waitForPayloadCount(1);
      expect(delay).toBeLessThan(IMMEDIATE_FLUSH_THRESHOLD);

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(1);

      client.evaluatedConfig(baseEvent);
      await sleep(FLUSH_DELAY * 1.25);
      expect(await commands.mswGetPayloads()).toHaveLength(1);
    });
  });
});
