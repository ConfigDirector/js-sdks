import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import type { ConfigDirectorClient, ConfigDirectorClientOptions } from "../src";
import { createBrowserClient } from "../src";
import {
  POLLING_URL,
  TELEMETRY_URL,
  createCapturingLogger,
  forgetCachedValues,
  hidePageFor,
  removeWorker,
} from "./helpers";

type TrackedEventEntry = {
  name: string;
  contextKind?: string;
  contextIdentifier?: string;
  value?: number;
  details?: Record<string, unknown>;
  happenedAt: string;
};
type TelemetryReport = { discreteEvents?: { trackedEvents?: TrackedEventEntry[] } };

const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs,
});

describe("tracked events", () => {
  let client: ConfigDirectorClient;
  let logger: ReturnType<typeof createCapturingLogger>;

  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  beforeEach(async () => {
    forgetCachedValues();
    logger = createCapturingLogger();
    await commands.mswUseHandlers(
      { url: POLLING_URL, responseBody: full() },
      { url: TELEMETRY_URL, status: 202 },
    );
  });

  afterEach(() => {
    client?.dispose();
    forgetCachedValues();
    vi.useRealTimers();
  });

  const createClient = (clientOptions?: ConfigDirectorClientOptions) =>
    createBrowserClient(
      "sdk-key",
      { sdkName: "test-sdk", sdkVersion: "1.2.0" },
      { logger, connection: { mode: "polling" }, ...clientOptions },
    );

  const trackedEventsSent = async (): Promise<TrackedEventEntry[]> => {
    const payloads = (await commands.mswGetPayloads()) as TelemetryReport[];
    return payloads.flatMap((payload) => payload.discreteEvents?.trackedEvents ?? []);
  };

  const trackedEventsSentOnceThePageIsHidden = async (expectedCount: number): Promise<TrackedEventEntry[]> => {
    await hidePageFor(0);
    return vi.waitFor(
      async () => {
        const entries = await trackedEventsSent();
        if (entries.length < expectedCount) {
          throw new Error(`Only ${entries.length} tracked events were sent so far`);
        }
        return entries;
      },
      { timeout: 8_000, interval: 50 },
    );
  };

  test("sends an event tracked for the client's context on the next telemetry batch with its value and details", async () => {
    client = createClient();
    await client.initialize({ id: "user-1" });
    vi.setSystemTime(new Date("2026-11-05T10:00:05.000Z"));

    client.track("checkout-completed", { value: 49.9, details: { plan: "pro", items: [{ sku: "book" }] } });

    expect(await trackedEventsSentOnceThePageIsHidden(1)).toEqual([
      {
        name: "checkout-completed",
        contextKind: "user",
        contextIdentifier: "user-1",
        value: 49.9,
        details: { plan: "pro", items: [{ sku: "book" }] },
        happenedAt: "2026-11-05T10:00:05.000Z",
      },
    ]);
  });

  test("sends the kind of the client's context", async () => {
    client = createClient();
    await client.initialize({ id: "acme", kind: "organization" });

    client.track("seat-added");

    const [entry] = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entry?.contextKind).toBe("organization");
    expect(entry?.contextIdentifier).toBe("acme");
  });

  test("sends an event tracked for a context without an id with no context kind or identifier and logs nothing", async () => {
    client = createClient();
    await client.initialize({ name: "Ada" });

    client.track("newsletter-signup-opened");

    const [entry] = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entry?.name).toBe("newsletter-signup-opened");
    expect(entry).not.toHaveProperty("contextKind");
    expect(entry).not.toHaveProperty("contextIdentifier");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("withholds the identifier of an anonymous context from the event tracked for it", async () => {
    client = createClient();
    await client.initialize({ id: "visitor-7", anonymous: true });

    client.track("checkout-completed");

    const [entry] = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entry?.name).toBe("checkout-completed");
    expect(entry).not.toHaveProperty("contextKind");
    expect(entry).not.toHaveProperty("contextIdentifier");
  });

  test("sends an event tracked before the client connected, without a context, once it has connected", async () => {
    client = createClient();

    client.track("app-opened");
    await client.initialize({ id: "user-1" });

    const [entry] = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entry?.name).toBe("app-opened");
    expect(entry).not.toHaveProperty("contextIdentifier");
  });

  test("sends each event for the context the client had when it was tracked", async () => {
    client = createClient();
    await client.initialize({ id: "user-1" });

    client.track("signed-out");
    await client.updateContext({ id: "user-2" });
    client.track("signed-in");

    const entries = await trackedEventsSentOnceThePageIsHidden(2);
    expect(entries.map((entry) => [entry.name, entry.contextIdentifier])).toEqual([
      ["signed-out", "user-1"],
      ["signed-in", "user-2"],
    ]);
  });

  test("leaves out details with 21 top-level keys, sends the event and logs a warning", async () => {
    client = createClient();
    await client.initialize({ id: "user-1" });
    const details = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`key-${index + 1}`, index + 1]));

    client.track("checkout-completed", { value: 49.9, details });

    const [entry] = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entry).toMatchObject({ name: "checkout-completed", value: 49.9 });
    expect(entry).not.toHaveProperty("details");
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(1));
  });

  test("does not send an event whose name has 151 characters and logs a warning", async () => {
    client = createClient();
    await client.initialize({ id: "user-1" });

    client.track("n".repeat(151));
    client.track("checkout-completed");

    const entries = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entries.map((entry) => entry.name)).toEqual(["checkout-completed"]);
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(1));
  });

  test("logs a repeated cause once until the telemetry batch is sent, and again in the following batch", async () => {
    client = createClient();
    await client.initialize({ id: "user-1" });

    client.track("");
    client.track("");
    client.track("checkout-completed");

    await trackedEventsSentOnceThePageIsHidden(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    client.track("");

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(2));
  });

  test("does not send the 1,001st event tracked before a batch is sent and logs a warning", async () => {
    client = createClient();
    await client.initialize({ id: "user-1" });

    for (let number = 1; number <= 1_001; number++) {
      client.track(`event-${number}`);
    }

    const entries = await trackedEventsSentOnceThePageIsHidden(1_000);
    expect(entries).toHaveLength(1_000);
    expect(entries[999]?.name).toBe("event-1000");
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(1));
  });

  test("does not send the 1,001st event tracked before the client connected and logs a warning", async () => {
    client = createClient();

    for (let number = 1; number <= 1_001; number++) {
      client.track(`event-${number}`);
    }
    await client.initialize({ id: "user-1" });

    const entries = await trackedEventsSentOnceThePageIsHidden(1_000);
    expect(entries).toHaveLength(1_000);
    expect(entries[999]?.name).toBe("event-1000");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test("does not throw for a context whose traits cannot be copied to the telemetry worker", async () => {
    client = createClient();
    await client.initialize({ id: "user-1", traits: { onSignOut: () => {} } });

    client.track("checkout-completed");

    const [entry] = await trackedEventsSentOnceThePageIsHidden(1);
    expect(entry).toMatchObject({ name: "checkout-completed", contextIdentifier: "user-1" });
  });

  test("does not throw and logs a warning for a context whose id cannot be copied to the telemetry worker", async () => {
    client = createClient();
    await client.initialize({ id: Symbol("user-1") as unknown as string });
    const warningsBeforeTracking = logger.warn.mock.calls.length;

    expect(() => client.track("checkout-completed")).not.toThrow();

    expect(logger.warn).toHaveBeenCalledTimes(warningsBeforeTracking + 1);
  });

  test("logs no warning for an event tracked after a client that never connected was disposed", async () => {
    client = createClient();
    client.dispose();

    client.track("");

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("logs no warning for an event tracked in offline mode that would not be reported", async () => {
    client = createBrowserClient(
      { logger, connection: { mode: "offline", values: {} } },
      { sdkName: "test-sdk", sdkVersion: "1.2.0" },
      undefined,
    );
    await client.initialize({ id: "user-1" });

    client.track("");

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("sends nothing and logs only that telemetry is off for an event tracked when Web Workers are unavailable", async () => {
    const restoreWorker = removeWorker();
    try {
      client = createClient();
      await client.initialize({ id: "user-1" });

      client.track("");
      client.track("checkout-completed");
      await hidePageFor(100);

      expect(await trackedEventsSent()).toEqual([]);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    } finally {
      restoreWorker();
    }
  });
});
