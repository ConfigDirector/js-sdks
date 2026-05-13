import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { OneTimeTransport } from "../src/OneTimeTransport";
import type { Transport } from "../src/types";
import { POLLING_URL, BASE_URL, createStubbedLogger } from "./helpers";

const fullBundle = {
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full" as const,
  configs: {},
  timestamp: "2024-01-01T00:00:00.000Z",
};

const createTransport = () =>
  new OneTimeTransport({
    serverSdkKey: "sdk-key",
    baseUrl: new URL(BASE_URL),
    metaContext: { sdkName: "js-server-sdk", sdkVersion: "__VERSION__" },
    logger: createStubbedLogger(),
  });

const server = setupServer();

describe("OneTimeTransport", () => {
  let transport: Transport;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  beforeEach(() => {
    server.resetHandlers();
    transport = createTransport();
  });
  afterAll(() => server.close());
  afterEach(() => transport?.dispose());

  describe("connect", () => {
    test("resolves when the server returns a 200 response", async () => {
      server.use(
        http.post(POLLING_URL, () => HttpResponse.json(fullBundle)),
      );

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

    test("does not include a lastUpdateTimestamp in the request body", async () => {
      let requestJson: any = undefined;
      server.use(
        http.post(POLLING_URL, async ({ request }) => {
          requestJson = await request.json();
          return HttpResponse.json(fullBundle);
        }),
      );

      await transport.connect(5000);

      expect(requestJson).not.toHaveProperty("lastUpdateTimestamp");
    });

    test("emits configBundleReceived with the response payload", async () => {
      server.use(
        http.post(POLLING_URL, () => HttpResponse.json(fullBundle)),
      );

      const received = new Promise<any>((resolve) => {
        transport.on("configBundleReceived", resolve);
      });

      await transport.connect(5000);
      expect(await received).toMatchObject(fullBundle);
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

    test("ignores reconnect attempts after a fatal error", async () => {
      let callCount = 0;
      server.use(
        http.post(POLLING_URL, () => {
          callCount++;
          return HttpResponse.text("Unauthorized", { status: 401 });
        }),
      );

      await expect(transport.connect(5000)).rejects.toThrow();
      await transport.connect(5000);

      expect(callCount).toBe(1);
    });

    test("rejects on a non-fatal error status", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.text("Server Error", { status: 500 })));

      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with status: 500");
    });
  });

  describe("isConnected", () => {
    test("returns false since it does not maintain a persistent connection or polling interval", async () => {
      expect(transport.isConnected).toBe(false);

      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      await transport.connect(5000);

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
    test("clears all listeners on dispose", async () => {
      server.use(http.post(POLLING_URL, () => HttpResponse.json(fullBundle)));

      const calls: number[] = [];
      transport.on("configBundleReceived", () => calls.push(1));
      transport.dispose();
      await transport.connect(5000);

      expect(calls).toHaveLength(0);
    });
  });
});
