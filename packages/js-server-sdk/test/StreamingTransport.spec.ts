import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { StreamingTransport } from "../src/StreamingTransport";
import type { Transport } from "../src/types";
import { sleep, SSE_URL, BASE_URL, createStubbedLogger } from "./helpers";

const buildResponse = (stream: ReadableStream) => {
  return new Response(stream, {
    headers: {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
};

const message = (data: any) => {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};

const createTransport = () =>
  new StreamingTransport({
    serverSdkKey: "sdk-key",
    baseUrl: new URL(BASE_URL),
    metaContext: { sdkName: "js-server-sdk", sdkVersion: "__VERSION__" },
    logger: createStubbedLogger(),
  });

const server = setupServer();

describe("StreamingTransport", () => {
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
    test("resolves when the connection is established", async () => {
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
            },
          });
          return buildResponse(stream);
        }),
      );

      await expect(transport.connect(5000)).resolves.toBe(transport);
    });

    test("sends the correct request body including serverSdkKey and metaContext", async () => {
      let requestJson: any = undefined;
      server.use(
        http.post(SSE_URL, async ({ request }) => {
          requestJson = await request.json();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
            },
          });
          return buildResponse(stream);
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

    test("rejects with a ConfigDirectorConnectionError on a 401 response", async () => {
      server.use(http.post(SSE_URL, () => HttpResponse.text("Unauthorized", { status: 401 })));

      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with status: 401");
    });

    test("rejects with a ConfigDirectorConnectionError on a 403 response", async () => {
      server.use(http.post(SSE_URL, () => HttpResponse.text("Forbidden", { status: 403 })));

      await expect(transport.connect(5000)).rejects.toThrow("Connection failed with status: 403");
    });

    test("includes the server response status in the error message", async () => {
      server.use(http.post(SSE_URL, () => HttpResponse.text("Invalid SDK key provided", { status: 401 })));

      await expect(transport.connect(5000)).rejects.toThrow(/Connection failed with status: 401/i);
    });

    test("resolves after timeout when connection is slow", async () => {
      server.use(
        http.post(SSE_URL, async () => {
          await sleep(200);
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
            },
          });
          return buildResponse(stream);
        }),
      );

      const result = await transport.connect(50);
      expect(result).toBe(transport);
      expect(transport.isConnected).toBe(false);
    });

    test("closes an existing connection before reconnecting", async () => {
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
            },
          });
          return buildResponse(stream);
        }),
      );

      await transport.connect(5000);
      const closeSpy = vi.spyOn(transport, "close");

      await transport.connect(5000);

      expect(closeSpy).toHaveBeenCalledOnce();
    });
  });

  describe("on / off", () => {
    test("emits configBundleReceived when a message is received", async () => {
      const bundle = { environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full" as const, configs: {} };
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message(bundle));
            },
          });
          return buildResponse(stream);
        }),
      );

      const received = new Promise<any>((resolve) => {
        transport.on("configBundleReceived", resolve);
      });

      await transport.connect(5000);
      expect(await received).toMatchObject(bundle);
    });

    test("emits multiple messages as they arrive", async () => {
      const bundle1 = { environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full" as const, configs: {} };
      const bundle2 = { environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "delta" as const, configs: {} };
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message(bundle1));
              setTimeout(() => controller.enqueue(message(bundle2)), 20);
            },
          });
          return buildResponse(stream);
        }),
      );

      const messages: any[] = [];
      transport.on("configBundleReceived", (b) => messages.push(b));

      await transport.connect(5000);
      await sleep(60);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject(bundle1);
      expect(messages[1]).toMatchObject(bundle2);
    });

    test("does not call a handler after off is called with that handler", async () => {
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
              setTimeout(
                () =>
                  controller.enqueue(
                    message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "delta", configs: {} }),
                  ),
                30,
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const calls: number[] = [];
      const handler = () => calls.push(1);

      transport.on("configBundleReceived", handler);
      await transport.connect(5000);
      await sleep(10); // Wait for initial event

      transport.off("configBundleReceived", handler);
      await sleep(60);

      expect(calls).toHaveLength(1);
    });

    test("removes all listeners for an event when off is called without a handler", async () => {
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
              setTimeout(
                () =>
                  controller.enqueue(
                    message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "delta", configs: {} }),
                  ),
                30,
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const calls: number[] = [];

      transport.on("configBundleReceived", () => calls.push(1));
      transport.on("configBundleReceived", () => calls.push(2));
      await transport.connect(5000);
      await sleep(10); // Wait for initial event
      transport.off("configBundleReceived");

      await sleep(60);

      expect(calls).toHaveLength(2);
    });
  });

  describe("dispose", () => {
    test("closes the connection and clears all listeners on dispose", async () => {
      server.use(
        http.post(SSE_URL, () => {
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "full", configs: {} }));
              setTimeout(
                () =>
                  controller.enqueue(
                    message({ environmentId: "10000000-0000-0000-0000-000000000000", projectId: "20000000-0000-0000-0000-000000000000", kind: "delta", configs: {} }),
                  ),
                30,
              );
            },
          });
          return buildResponse(stream);
        }),
      );

      const transport = createTransport();
      const calls: number[] = [];
      transport.on("configBundleReceived", () => calls.push(1));

      await transport.connect(5000);
      await sleep(10); // Wait for initial event
      transport.dispose();

      await sleep(60);

      expect(calls).toHaveLength(1);
    });
  });
});
