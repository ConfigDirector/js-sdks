import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { PollingTransport } from "../src/PollingTransport";
import type { Transport } from "../src/types";
import { POLLING_URL, BASE_URL, createStubbedLogger } from "./helpers";

const fullBundle = {
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full" as const,
  configs: {},
  timestamp: "2024-01-01T00:00:00.000Z",
};

const deltaBundle = {
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "delta" as const,
  configs: {},
  timestamp: "2024-01-01T00:01:00.000Z",
};

const createTransport = (pollingInterval = 60) =>
  new PollingTransport({
    serverSdkKey: "sdk-key",
    baseUrl: new URL(BASE_URL),
    metaContext: { sdkName: "js-server-sdk", sdkVersion: "__VERSION__" },
    logger: createStubbedLogger(),
    pollingInterval,
  });

const server = setupServer();

describe("PollingTransport", () => {
  let transport: Transport;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  beforeEach(() => {
    server.resetHandlers();
    transport = createTransport();
  });
  afterAll(() => server.close());
  afterEach(() => {
    transport?.dispose();
    vi.useRealTimers();
  });

  describe("connect", () => {
    test("resolves after the initial fetch succeeds", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      await expect(transport.connect(5000)).resolves.toBe(transport);
    });

    test("sends the correct request body including serverSdkKey and metaContext", async () => {
      let requestJson: any = undefined;
      server.use(
        http.post(POLLING_URL, async ({ request }) => {
          requestJson = await request.json();
          return HttpResponse.json(fullBundle);
        }),
      );

      await transport.connect(5000);

      expect(requestJson).toMatchObject(
        expect.objectContaining({
          serverSdkKey: "sdk-key",
          metaContext: expect.objectContaining({ sdkName: "js-server-sdk", sdkVersion: "__VERSION__" }),
        }),
      );
    });

    test("sends a UUID sessionId in the request body", async () => {
      let requestJson: any = undefined;
      server.use(
        http.post(POLLING_URL, async ({ request }) => {
          requestJson = await request.json();
          return HttpResponse.json(fullBundle);
        }),
      );

      await transport.connect(5000);

      expect(requestJson.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    test("sends the same sessionId on every poll", async () => {
      const capturedSessionIds: string[] = [];
      server.use(
        http.post(POLLING_URL, async ({ request }) => {
          const requestJson: any = await request.json();
          capturedSessionIds.push(requestJson.sessionId);
          return HttpResponse.json(fullBundle);
        }),
      );

      vi.useFakeTimers();
      transport = createTransport(1);
      await transport.connect(5000);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(capturedSessionIds).toHaveLength(2);
      expect(capturedSessionIds[0]).toBeDefined();
      expect(capturedSessionIds[1]).toBe(capturedSessionIds[0]);
    });

    test("sends null lastUpdateTimestamp on the first request", async () => {
      let requestJson: any = undefined;
      server.use(
        http.post(POLLING_URL, async ({ request }) => {
          requestJson = await request.json();
          return HttpResponse.json(fullBundle);
        }),
      );

      await transport.connect(5000);

      expect(requestJson.lastUpdateTimestamp).toBeUndefined();
    });

    test("sends the timestamp from the previous response on subsequent requests", async () => {
      const requestBodies: any[] = [];
      server.use(
        http.post(POLLING_URL, async ({ request }) => {
          requestBodies.push(await request.json());
          if (requestBodies.length === 1) {
            return HttpResponse.json(fullBundle);
          }
          return HttpResponse.json(deltaBundle);
        }),
      );

      vi.useFakeTimers();
      transport = createTransport(1);
      await transport.connect(5000);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(requestBodies).toHaveLength(2);
      expect(requestBodies[1].lastUpdateTimestamp).toBe(fullBundle.timestamp);
    });

    test("emits configBundleReceived with the full bundle on the initial fetch", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      const received = new Promise<any>((resolve) => {
        transport.on("configBundleReceived", resolve);
      });

      await transport.connect(5000);
      expect(await received).toMatchObject(fullBundle);
    });

    test("emits configBundleReceived on each polling interval", async () => {
      const bundles = [fullBundle, deltaBundle];
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => HttpResponse.json(bundles[Math.min(callCount++, 1)])),
      );

      const received: any[] = [];
      transport.on("configBundleReceived", (b) => received.push(b));

      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("configBundleReceived", (b) => received.push(b));
      await transport.connect(5000);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(received.length).toBeGreaterThanOrEqual(2);
    });

    test("does not emit configBundleReceived on a 204 (no change) response", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 1) return HttpResponse.json(fullBundle);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const received: any[] = [];
      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("configBundleReceived", (b) => received.push(b));
      await transport.connect(5000);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(received).toHaveLength(1);
    });

    test("rejects with a ConfigDirectorConnectionError on a 401 response", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.text("Unauthorized", { status: 401 })));

      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with status: 401");
    });

    test("rejects with a ConfigDirectorConnectionError on a 403 response", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.text("Forbidden", { status: 403 })));

      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with status: 403");
    });

    test("includes the server response body in the error message for fatal errors", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.text("Invalid SDK key provided", { status: 401 })));

      await expect(transport.connect(5000)).rejects.toThrow(/Invalid SDK key provided/);
    });

    test("stops polling after a fatal error", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 1) return HttpResponse.json(fullBundle);
          return HttpResponse.text("Unauthorized", { status: 401 });
        }),
      );

      vi.useFakeTimers();
      transport = createTransport(1);
      await transport.connect(5000);
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(callCount).toBe(2);
    });

    test("keeps polling after a transient failure on connect", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 1) return HttpResponse.text("Server error", { status: 500 });
          return HttpResponse.json(fullBundle);
        }),
      );

      const received: any[] = [];
      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("configBundleReceived", (b) => received.push(b));
      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with status: 500");

      await vi.advanceTimersByTimeAsync(1_000);

      expect(callCount).toBe(2);
      expect(received).toHaveLength(1);
    });

    test("closes the transport when a poll receives a fatal response", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 1) return HttpResponse.json(fullBundle);
          return HttpResponse.text("Unauthorized", { status: 401 });
        }),
      );

      vi.useFakeTimers();
      transport = createTransport(1);
      await transport.connect(5000);
      expect(transport.isConnected).toBe(true);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(transport.isConnected).toBe(false);
    });

    test("emits connectionError when a poll receives a fatal response", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 1) return HttpResponse.json(fullBundle);
          return HttpResponse.text("Unauthorized", { status: 401 });
        }),
      );

      const errors: Error[] = [];
      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("connectionError", (error: Error) => errors.push(error));
      await transport.connect(5000);
      expect(errors).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toMatch(/401/);
    });

    test("keeps polling after a network error on connect", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 1) return HttpResponse.error();
          return HttpResponse.json(fullBundle);
        }),
      );

      const received: any[] = [];
      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("configBundleReceived", (b) => received.push(b));
      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with error");

      await vi.advanceTimersByTimeAsync(1_000);

      expect(callCount).toBe(2);
      expect(received).toHaveLength(1);
    });

    test("keeps polling after a network error during a poll", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          if (callCount === 2) return HttpResponse.error();
          return HttpResponse.json(fullBundle);
        }),
      );

      const received: any[] = [];
      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("configBundleReceived", (b) => received.push(b));
      await transport.connect(5000);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(callCount).toBe(3);
      expect(received).toHaveLength(2);
    });

    test("resets the polling interval when connect is called again", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      const received: any[] = [];
      transport.on("configBundleReceived", (b) => received.push(b));

      await transport.connect(5000);
      await transport.connect(5000);

      expect(received).toHaveLength(2);
    });
  });

  describe("isConnected", () => {
    test("returns false before connect is called", () => {
      expect(transport.isConnected).toBe(false);
    });

    test("returns true after a successful connect", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      await transport.connect(5000);

      expect(transport.isConnected).toBe(true);
    });

    test("returns false after close is called", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      await transport.connect(5000);
      transport.close();

      expect(transport.isConnected).toBe(false);
    });
  });

  describe("on / off", () => {
    test("does not call a handler after off is called with that handler", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      const calls: number[] = [];
      const handler = () => calls.push(1);

      transport.on("configBundleReceived", handler);
      transport.off("configBundleReceived", handler);
      await transport.connect(5000);

      expect(calls).toHaveLength(0);
    });

    test("removes all listeners for an event when off is called without a handler", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      const calls: number[] = [];
      transport.on("configBundleReceived", () => calls.push(1));
      transport.on("configBundleReceived", () => calls.push(2));
      transport.off("configBundleReceived");
      await transport.connect(5000);

      expect(calls).toHaveLength(0);
    });
  });

  describe("dispose", () => {
    test("stops polling and clears all listeners on dispose", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          return HttpResponse.json(fullBundle);
        }),
      );

      const calls: number[] = [];
      vi.useFakeTimers();
      transport = createTransport(1);
      transport.on("configBundleReceived", () => calls.push(1));
      await transport.connect(5000);

      transport.dispose();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(callCount).toBe(1);
      expect(calls).toHaveLength(1);
    });
  });

  describe("close", () => {
    test("stops the polling interval", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          return HttpResponse.json(fullBundle);
        }),
      );

      vi.useFakeTimers();
      transport = createTransport(1);
      await transport.connect(5000);

      transport.close();
      await vi.advanceTimersByTimeAsync(3_000);

      expect(callCount).toBe(1);
    });
  });
});
