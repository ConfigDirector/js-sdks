import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { ServerTelemetryEventCollector } from "../../src/telemetry/ServerTelemetryEventCollector";
import { BASE_URL, createStubbedLogger, TELEMETRY_URL } from "../helpers";
import { defaultUrlFactory } from "@shared/url";

const logger = createStubbedLogger();

const createCollector = (options: Record<string, unknown> = {}) =>
  new ServerTelemetryEventCollector({
    sdkKey: "sdk-key",
    logger,
    baseUrl: new URL(BASE_URL),
    urlFactory: defaultUrlFactory,
    ...options,
  });

const baseEvaluation = {
  key: "my-config",
  type: "string" as const,
  defaultValue: "default",
  requestedType: "string",
  evaluatedValue: "hello",
  usedDefault: false,
  evaluationReason: "found-match" as const,
};

const basePayload = {
  context: {
    id: "user-id",
  },
  evaluation: baseEvaluation,
};

let capturedPayloads: any[];

const server = setupServer(
  http.post(TELEMETRY_URL, async ({ request }) => {
    capturedPayloads.push(await request.json());
    return HttpResponse.json({});
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

describe("ServerTelemetryEventCollector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedPayloads = [];
    server.resetHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("evaluatedConfig", () => {
    test("sends queued events via HTTP on flush", async () => {
      const collector = createCollector();
      collector.evaluatedConfig(basePayload);

      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads).toHaveLength(1);
      const payload = capturedPayloads[0];
      expect(payload.serverSdkKey).toBe("sdk-key");
      expect(payload.aggregatedEvents.evaluatedConfig).toHaveLength(1);
      expect(payload.aggregatedEvents.evaluatedConfig[0]).toMatchObject({
        count: 1,
        event: expect.objectContaining({
          contextId: "user-id",
          key: "my-config",
          type: "string",
          evaluatedValue: "hello",
          evaluationReason: "found-match",
        }),
      });
    });

    test("does not send a request when there are no events", async () => {
      createCollector();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(capturedPayloads).toHaveLength(0);
    });

    test("aggregates duplicate events into a single entry with a count", async () => {
      const collector = createCollector();
      collector.evaluatedConfig(basePayload);
      collector.evaluatedConfig(basePayload);
      collector.evaluatedConfig(basePayload);

      await vi.advanceTimersByTimeAsync(5_000);

      const payload = capturedPayloads[0];
      expect(payload.aggregatedEvents.evaluatedConfig).toHaveLength(1);
      expect(payload.aggregatedEvents.evaluatedConfig[0].count).toBe(3);
    });

    test("sends distinct events as separate aggregated entries", async () => {
      const collector = createCollector();
      collector.evaluatedConfig({
        evaluation: { ...baseEvaluation, key: "config-a", evaluatedValue: "foo" },
      });
      collector.evaluatedConfig({
        evaluation: { ...baseEvaluation, key: "config-b", evaluatedValue: "bar" },
      });

      await vi.advanceTimersByTimeAsync(5_000);

      const payload = capturedPayloads[0];
      expect(payload.aggregatedEvents.evaluatedConfig).toHaveLength(2);
    });

    test("sanitizes JSON config values by replacing them with a hash", async () => {
      const collector = createCollector();
      collector.evaluatedConfig({
        evaluation: {
          key: "json-config",
          type: "json",
          defaultValue: { foo: "bar" },
          requestedType: "json",
          evaluatedValue: { baz: 42 },
          usedDefault: false,
          evaluationReason: "found-match",
        },
      });

      await vi.advanceTimersByTimeAsync(5_000);

      const event = capturedPayloads[0].aggregatedEvents.evaluatedConfig[0].event;
      expect(event.evaluatedValue).toMatch(/^[0-9a-f]{8}$/);
      expect(event.defaultValue).toMatch(/^[0-9a-f]{8}$/);
    });

    test("truncates string values longer than 500 characters", async () => {
      const longValue = "x".repeat(600);
      const collector = createCollector();
      collector.evaluatedConfig({ evaluation: { ...baseEvaluation, evaluatedValue: longValue } });

      await vi.advanceTimersByTimeAsync(5_000);

      const event = capturedPayloads[0].aggregatedEvents.evaluatedConfig[0].event;
      expect(event.evaluatedValue).toHaveLength(500);
    });
  });

  describe("capturedContexts", () => {
    test("includes context in discreteEvents when context has an id", async () => {
      const collector = createCollector();
      collector.evaluatedConfig(basePayload);

      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads[0].discreteEvents.capturedContexts).toEqual([{ id: "user-id" }]);
    });

    test("does not include context when context has no id", async () => {
      const collector = createCollector();
      collector.evaluatedConfig({ evaluation: baseEvaluation });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads[0].discreteEvents.capturedContexts).toEqual([]);
    });

    test("deduplicates contexts with the same id", async () => {
      const collector = createCollector();
      collector.evaluatedConfig(basePayload);
      collector.evaluatedConfig(basePayload);
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-id", name: "Admin" } });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads[0].discreteEvents.capturedContexts).toHaveLength(1);
    });

    test("captures distinct contexts separately", async () => {
      const collector = createCollector();
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-a" } });
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-b" } });

      await vi.advanceTimersByTimeAsync(5_000);

      const contexts = capturedPayloads[0].discreteEvents.capturedContexts;
      expect(contexts).toHaveLength(2);
      expect(contexts.map((c: { id: string }) => c.id).sort()).toEqual(["user-a", "user-b"]);
    });

    test("clears contexts after flush so they are not resent", async () => {
      const collector = createCollector({ flushIntervalDelay: 10_000, initialFlushIntervalDelay: 5_000 });
      collector.evaluatedConfig(basePayload);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(capturedPayloads[0].discreteEvents.capturedContexts).toHaveLength(1);

      collector.evaluatedConfig(basePayload);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(capturedPayloads[1].discreteEvents.capturedContexts).toHaveLength(1);
    });

    test("reports zero dropped contexts when the limit is not exceeded", async () => {
      const collector = createCollector();
      collector.evaluatedConfig(basePayload);

      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads[0].droppedEvents.capturedContexts).toBe(0);
    });

    test("reports accurate dropped context count when the limit is exceeded", async () => {
      const collector = createCollector({ contextLimit: 2 });
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-a" } });
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-b" } });
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-c" } });
      collector.evaluatedConfig({ ...basePayload, context: { id: "user-d" } });

      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads[0].droppedEvents.capturedContexts).toBe(2);
      expect(capturedPayloads[0].discreteEvents.capturedContexts).toHaveLength(2);
    });
  });

  describe("flush interval", () => {
    test("re-schedules flushing after each interval", async () => {
      const collector = createCollector({ flushIntervalDelay: 10_000, initialFlushIntervalDelay: 5_000 });

      collector.evaluatedConfig(basePayload);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(capturedPayloads).toHaveLength(1);

      collector.evaluatedConfig(basePayload);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(capturedPayloads).toHaveLength(2);
    });
  });

  describe("fatal error handling", () => {
    test("stops collecting events after a fatal HTTP response", async () => {
      server.use(http.post(TELEMETRY_URL, () => HttpResponse.json({}, { status: 401 })));

      const collector = createCollector();
      collector.evaluatedConfig(basePayload);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(capturedPayloads).toHaveLength(0);

      // Further events should be silently dropped
      collector.evaluatedConfig({ evaluation: { ...baseEvaluation, key: "config-after-fatal" } });
      await vi.advanceTimersByTimeAsync(35_000);
      expect(capturedPayloads).toHaveLength(0);
    });
  });

  describe("close", () => {
    test("flushes remaining events on close", async () => {
      const collector = createCollector();
      collector.evaluatedConfig(basePayload);

      collector.close();
      await vi.advanceTimersByTimeAsync(0);

      expect(capturedPayloads).toHaveLength(1);
    });

    test("stops collecting events after close", async () => {
      const collector = createCollector();
      collector.close();

      collector.evaluatedConfig(basePayload);
      await vi.advanceTimersByTimeAsync(5_000);

      expect(capturedPayloads).toHaveLength(0);
    });
  });
});
