import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http } from "msw";
import { createClient } from "../src";
import type { ConfigDirectorClient, ConfigDirectorLogger } from "../src";
import { createStubbedLogger, sleep, SSE_URL, TELEMETRY_URL } from "./helpers";

const buildResponse = (stream: ReadableStream) =>
  new Response(stream, {
    headers: { connection: "keep-alive", "content-type": "text/event-stream", "cache-control": "no-cache" },
  });

const message = (data: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

type TrackedEventEntry = {
  name: string;
  contextKind?: string;
  contextIdentifier?: string;
  value?: number;
  details?: Record<string, unknown>;
  happenedAt: string;
};
type TelemetryReport = { discreteEvents: { trackedEvents: TrackedEventEntry[] } };

const server = setupServer();

describe("tracked events", () => {
  let reports: TelemetryReport[];
  let loggedWarnings: unknown[][];
  let loggedErrors: unknown[][];
  let logger: ConfigDirectorLogger;

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    server.resetHandlers();
    reports = [];
    loggedWarnings = [];
    loggedErrors = [];
    logger = {
      ...createStubbedLogger(),
      warn: (...args: unknown[]) => loggedWarnings.push(args),
      error: (...args: unknown[]) => loggedErrors.push(args),
    };
    server.use(
      http.post(TELEMETRY_URL, async ({ request }) => {
        reports.push((await request.json()) as TelemetryReport);
        return new Response(null, { status: 204 });
      }),
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs: {},
                }),
              );
            },
          }),
        ),
      ),
    );
  });
  afterEach(() => vi.useRealTimers());
  afterAll(() => server.close());

  const initializedClient = async (): Promise<ConfigDirectorClient> => {
    const client = createClient("sdk-key", { logger });
    await client.initialize();
    return client;
  };

  const trackedEventsSentOnDispose = async (client: ConfigDirectorClient): Promise<TrackedEventEntry[]> => {
    client.dispose();
    return vi.waitFor(() => {
      const [report] = reports;
      if (!report) {
        throw new Error("No telemetry report was sent yet");
      }
      return report.discreteEvents.trackedEvents;
    });
  };

  test("sends an event tracked for a context on the next telemetry batch with its value and details", async () => {
    const client = await initializedClient();
    vi.setSystemTime(new Date("2026-11-05T10:00:05.000Z"));

    client.track(
      "checkout-completed",
      { id: "user-1" },
      { value: 49.9, details: { plan: "pro", seats: 3, trial: false, items: [{ sku: "book" }] } },
    );

    expect(await trackedEventsSentOnDispose(client)).toEqual([
      {
        name: "checkout-completed",
        contextKind: "user",
        contextIdentifier: "user-1",
        value: 49.9,
        details: { plan: "pro", seats: 3, trial: false, items: [{ sku: "book" }] },
        happenedAt: "2026-11-05T10:00:05.000Z",
      },
    ]);
  });

  test("sends an event tracked without a context with no context kind or identifier and logs nothing", async () => {
    const client = await initializedClient();
    vi.setSystemTime(new Date("2026-11-05T10:00:05.000Z"));

    client.track("nightly-import-finished");

    expect(await trackedEventsSentOnDispose(client)).toEqual([
      { name: "nightly-import-finished", happenedAt: "2026-11-05T10:00:05.000Z" },
    ]);
    expect(loggedWarnings).toEqual([]);
    expect(loggedErrors).toEqual([]);
  });

  test("sends an event tracked for a context without an id with no context kind or identifier and logs nothing", async () => {
    const client = await initializedClient();
    vi.setSystemTime(new Date("2026-11-05T10:00:05.000Z"));

    client.track("checkout-completed", { kind: "organization", name: "Acme" });

    expect(await trackedEventsSentOnDispose(client)).toEqual([
      { name: "checkout-completed", happenedAt: "2026-11-05T10:00:05.000Z" },
    ]);
    expect(loggedWarnings).toEqual([]);
    expect(loggedErrors).toEqual([]);
  });

  test("sends the kind of the context an event was tracked for", async () => {
    const client = await initializedClient();

    client.track("seat-added", { id: "acme", kind: "organization" });

    const [entry] = await trackedEventsSentOnDispose(client);
    expect(entry?.contextKind).toBe("organization");
    expect(entry?.contextIdentifier).toBe("acme");
  });

  test("withholds the identifier of an anonymous context from the event tracked for it", async () => {
    const client = await initializedClient();
    vi.setSystemTime(new Date("2026-11-05T10:00:05.000Z"));

    client.track("checkout-completed", { id: "visitor-7", anonymous: true });

    expect(await trackedEventsSentOnDispose(client)).toEqual([
      { name: "checkout-completed", happenedAt: "2026-11-05T10:00:05.000Z" },
    ]);
  });

  test("logs the invalid kind of a context as evaluations do and sends the event without a context", async () => {
    const client = await initializedClient();
    vi.setSystemTime(new Date("2026-11-05T10:00:05.000Z"));

    client.track("checkout-completed", { id: "acme", kind: "Tenant" });

    expect(loggedErrors).toEqual([[expect.stringContaining("'Tenant'")]]);
    expect(await trackedEventsSentOnDispose(client)).toEqual([
      { name: "checkout-completed", happenedAt: "2026-11-05T10:00:05.000Z" },
    ]);
  });

  describe("event names", () => {
    test("sends an event whose name has 150 characters", async () => {
      const client = await initializedClient();

      client.track("n".repeat(150));

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("n".repeat(150));
      expect(loggedWarnings).toEqual([]);
    });

    test("counts a character outside the basic plane as one character of the name", async () => {
      const client = await initializedClient();

      client.track("😀".repeat(150));

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(loggedWarnings).toEqual([]);
    });

    test("does not send an event whose name has 151 characters and logs a warning", async () => {
      const client = await initializedClient();

      client.track("n".repeat(151));
      client.track("checkout-completed");

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("checkout-completed");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("does not send an event whose name is empty and logs a warning", async () => {
      const client = await initializedClient();

      client.track("");
      client.track("checkout-completed");

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("checkout-completed");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("does not send an event whose name is not a string, without throwing", async () => {
      const client = await initializedClient();

      client.track(undefined as unknown as string);
      client.track("checkout-completed");

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("checkout-completed");
      expect(loggedWarnings).toHaveLength(1);
    });
  });

  describe("values", () => {
    test("sends a value with every digit it was given", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { value: 1234567.891 });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.value).toBe(1234567.891);
    });

    test("sends a value of zero", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { value: 0 });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.value).toBe(0);
    });

    test("leaves out a value that is not a number, sends the event and logs a warning", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { value: Number.NaN, details: { plan: "pro" } });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry).toMatchObject({ name: "checkout-completed", details: { plan: "pro" } });
      expect(entry).not.toHaveProperty("value");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("leaves out an infinite value, sends the event and logs a warning", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { value: Number.POSITIVE_INFINITY });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.name).toBe("checkout-completed");
      expect(entry).not.toHaveProperty("value");
      expect(loggedWarnings).toHaveLength(1);
    });
  });

  describe("details", () => {
    const detailsWithKeys = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, index) => [`key-${index + 1}`, index + 1]));

    test("sends details with 20 top-level keys", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { details: detailsWithKeys(20) });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(Object.keys(entry?.details ?? {})).toHaveLength(20);
      expect(loggedWarnings).toEqual([]);
    });

    test("leaves out details with 21 top-level keys, sends the event and logs a warning", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { value: 49.9, details: detailsWithKeys(21) });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry).toMatchObject({ name: "checkout-completed", contextIdentifier: "user-1", value: 49.9 });
      expect(entry).not.toHaveProperty("details");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("sends details of exactly 1,024 bytes as JSON", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { details: { note: "a".repeat(1_013) } });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.details).toEqual({ note: "a".repeat(1_013) });
      expect(loggedWarnings).toEqual([]);
    });

    test("leaves out details of 1,025 bytes as JSON, sends the event and logs a warning", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { details: { note: "a".repeat(1_014) } });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.name).toBe("checkout-completed");
      expect(entry).not.toHaveProperty("details");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("measures details in bytes, so 507 two-byte characters are left out", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { details: { note: "é".repeat(507) } });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.name).toBe("checkout-completed");
      expect(entry).not.toHaveProperty("details");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("leaves out details that cannot be written as JSON, without throwing", async () => {
      const client = await initializedClient();
      const circular: Record<string, unknown> = {};
      circular["self"] = circular;

      client.track("checkout-completed", { id: "user-1" }, { details: circular as never });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.name).toBe("checkout-completed");
      expect(entry).not.toHaveProperty("details");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("leaves out details that are a list rather than an object", async () => {
      const client = await initializedClient();

      client.track("checkout-completed", { id: "user-1" }, { details: ["pro"] as never });

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.name).toBe("checkout-completed");
      expect(entry).not.toHaveProperty("details");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("sends the details as they were when the event was tracked", async () => {
      const client = await initializedClient();
      const details = { plan: "pro" };

      client.track("checkout-completed", { id: "user-1" }, { details });
      details.plan = "enterprise";

      const [entry] = await trackedEventsSentOnDispose(client);
      expect(entry?.details).toEqual({ plan: "pro" });
    });
  });

  describe("the limit of 1,000 events per telemetry batch", () => {
    const trackEvents = (client: ConfigDirectorClient, count: number) => {
      for (let number = 1; number <= count; number++) {
        client.track(`event-${number}`);
      }
    };

    test("sends 1,000 events tracked before a batch is sent", async () => {
      const client = await initializedClient();

      trackEvents(client, 1_000);

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1_000);
      expect(loggedWarnings).toEqual([]);
    });

    test("does not send the 1,001st event tracked before a batch is sent and logs a warning", async () => {
      const client = await initializedClient();

      trackEvents(client, 1_001);

      const entries = await trackedEventsSentOnDispose(client);
      expect(entries).toHaveLength(1_000);
      expect(entries[0]?.name).toBe("event-1");
      expect(entries[999]?.name).toBe("event-1000");
      expect(loggedWarnings).toHaveLength(1);
    });

    test("logs one warning for every event beyond the limit of one batch", async () => {
      const client = await initializedClient();

      trackEvents(client, 1_003);

      expect(loggedWarnings).toHaveLength(1);
      client.dispose();
    });

    test("logs only the warning about the limit for an event beyond it whose value would be left out", async () => {
      const client = await initializedClient();
      trackEvents(client, 1_000);

      client.track("checkout-completed", undefined, { value: Number.NaN });

      expect(loggedWarnings).toHaveLength(1);
      client.dispose();
    });

    test("sends events tracked after a full batch was sent on the following batch", async () => {
      vi.useFakeTimers();
      const client = await initializedClient();
      trackEvents(client, 1_001);
      await vi.advanceTimersByTimeAsync(5_000);

      client.track("checkout-completed");
      await vi.advanceTimersByTimeAsync(30_000);

      expect(reports).toHaveLength(2);
      expect(reports[1]?.discreteEvents.trackedEvents).toMatchObject([{ name: "checkout-completed" }]);
      client.dispose();
    });
  });

  describe("warnings", () => {
    test("logs a repeated cause once until the telemetry batch is sent, and again in the following batch", async () => {
      vi.useFakeTimers();
      const client = await initializedClient();

      client.track("");
      client.track("");

      expect(loggedWarnings).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(5_000);
      client.track("");

      expect(loggedWarnings).toHaveLength(2);
      client.dispose();
    });

    test("logs each cause of one batch separately", async () => {
      const client = await initializedClient();

      client.track("");
      client.track("checkout-completed", undefined, { value: Number.NaN });
      client.track("checkout-completed", undefined, { details: ["pro"] as never });

      expect(loggedWarnings).toHaveLength(3);
      client.dispose();
    });
  });

  test("does not throw and logs a warning when the options cannot be read", async () => {
    const client = await initializedClient();
    const options = {
      get value(): number {
        throw new Error("The cart is gone");
      },
    };

    expect(() => client.track("checkout-completed", { id: "user-1" }, options)).not.toThrow();

    expect(loggedWarnings).toHaveLength(1);
    client.dispose();
  });

  describe("a client that sends no telemetry", () => {
    const offlineClient = async (): Promise<ConfigDirectorClient> => {
      const client = createClient({ connection: { mode: "offline", values: {} }, logger });
      await client.initialize();
      return client;
    };

    test("sends nothing for an event tracked in offline mode", async () => {
      const client = await offlineClient();

      client.track("checkout-completed", { id: "user-1" }, { value: 49.9 });
      client.dispose();
      await sleep(50);

      expect(reports).toEqual([]);
    });

    test("logs no warning for an event tracked in offline mode that would not be reported", async () => {
      const client = await offlineClient();

      client.track("");

      expect(loggedWarnings).toEqual([]);
      client.dispose();
    });

    test("logs no error for an event tracked in offline mode for a context with an invalid kind", async () => {
      const client = await offlineClient();

      client.track("checkout-completed", { id: "acme", kind: "Tenant" });

      expect(loggedErrors).toEqual([]);
      client.dispose();
    });

    test("logs no warning for an event tracked after ConfigDirector refused the SDK key", async () => {
      server.use(http.post(TELEMETRY_URL, () => new Response(null, { status: 401 })));
      vi.useFakeTimers();
      const client = await initializedClient();
      client.track("checkout-completed");
      await vi.advanceTimersByTimeAsync(5_000);
      loggedWarnings.splice(0);

      client.track("");

      expect(loggedWarnings).toEqual([]);
      client.dispose();
    });
  });
});
