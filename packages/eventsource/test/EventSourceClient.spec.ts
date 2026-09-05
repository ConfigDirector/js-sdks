import { describe, test, beforeAll, beforeEach, afterAll, expect } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { EventSourceClient } from "../src/EventSourceClient";
import type { EventSourceMessage} from "../src/types";
import { ReadyState } from "../src/types";
import { ValueOutOfRangeError } from "../src/errors";
import { createEventSourceClient } from "../src";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const sseResponse = (stream: ReadableStream) =>
  new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });

const encode = (text: string) => new TextEncoder().encode(text);

const streamOf = (...chunks: string[]) =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encode(chunk));
      controller.close();
    },
  });

const server = setupServer();

describe("EventSourceClient", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("request configuration", () => {
    test("sends Accept: text/event-stream header", async () => {
      const url = "http://localhost/sse";
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(url, ({ request }) => {
          capturedHeaders = request.headers;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const client = createEventSourceClient({ url, shouldReconnect: () => false });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(capturedHeaders?.get("accept")).toBe("text/event-stream");
    });

    test("merges custom headers with default Accept header", async () => {
      const url = "http://localhost/sse";
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(url, ({ request }) => {
          capturedHeaders = request.headers;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const client = createEventSourceClient({
        url,
        headers: { Authorization: "Bearer token123", "X-Custom": "value" },
        shouldReconnect: () => false,
      });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(capturedHeaders?.get("accept")).toBe("text/event-stream");
      expect(capturedHeaders?.get("authorization")).toBe("Bearer token123");
      expect(capturedHeaders?.get("x-custom")).toBe("value");
    });

    test("sends Last-Event-ID header when lastEventId is configured", async () => {
      const url = "http://localhost/sse";
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(url, ({ request }) => {
          capturedHeaders = request.headers;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const client = createEventSourceClient({ url, lastEventId: "42", shouldReconnect: () => false });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(capturedHeaders?.get("last-event-id")).toBe("42");
    });

    test("sends Last-Event-ID from server-provided event id on reconnect", async () => {
      const url = "http://localhost/sse";
      let requestCount = 0;
      const capturedLastEventIds: Array<string | null> = [];

      server.use(
        http.get(url, ({ request }) => {
          requestCount++;
          capturedLastEventIds.push(request.headers.get("last-event-id"));
          if (requestCount === 1) {
            // First response: server assigns event id 99
            return sseResponse(streamOf("id: 99\ndata: first\n\n"));
          }
          // Second response: a plain event with no id
          return sseResponse(streamOf("data: second\n\n"));
        }),
      );

      // Count onConnect calls to know when the second connection is open,
      // then stop after it to avoid further reconnects leaking.
      let connectCount = 0;
      await new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          calculateReconnectDelay: () => 1,
          onConnect: () => connectCount++,
          shouldReconnect: () => {
            if (connectCount >= 2) {
              resolve();
              return false;
            }
            return true;
          },
        });
        client.connect();
      });

      expect(capturedLastEventIds[0]).toBeNull(); // no id on first request
      expect(capturedLastEventIds[1]).toBe("99"); // server-provided id sent on reconnect
    });

    test("does not send Last-Event-ID header when lastEventId is absent", async () => {
      const url = "http://localhost/sse";
      let capturedHeaders: Headers | undefined;

      server.use(
        http.get(url, ({ request }) => {
          capturedHeaders = request.headers;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const client = createEventSourceClient({ url, shouldReconnect: () => false });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(capturedHeaders?.get("last-event-id")).toBeNull();
    });

    test("sends body with POST method", async () => {
      const url = "http://localhost/sse";
      let capturedBody: string | undefined;

      server.use(
        http.post(url, async ({ request }) => {
          capturedBody = await request.text();
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const client = createEventSourceClient({
        url,
        method: "POST",
        body: '{"filter":"test"}',
        shouldReconnect: () => false,
      });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(capturedBody).toBe('{"filter":"test"}');
    });

    test("invokes a body function on each connection attempt and sends its result", async () => {
      const url = "http://localhost/sse";
      const capturedBodies: string[] = [];

      server.use(
        http.post(url, async ({ request }) => {
          capturedBodies.push(await request.text());
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      let bodyCallCount = 0;
      let connectCount = 0;
      await new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          method: "POST",
          body: () => `attempt-${++bodyCallCount}`,
          calculateReconnectDelay: () => 1,
          onConnect: () => connectCount++,
          shouldReconnect: () => {
            if (connectCount >= 2) {
              resolve();
              return false;
            }
            return true;
          },
        });
        client.connect();
      });

      expect(capturedBodies).toEqual(["attempt-1", "attempt-2"]);
    });

    test.each([301, 302, 303, 307, 308])("follows redirects by default (%s)", async (status: number) => {
      const url = "http://localhost/sse";
      let originalHeaders: Headers | undefined;
      let redirectedHeaders: Headers | undefined;

      server.use(
        http.get("http://localhost/redirected-sse", ({ request }) => {
          redirectedHeaders = request.headers;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
        http.get(url, ({ request }) => {
          originalHeaders = request.headers;
          return Response.redirect("http://localhost/redirected-sse", status);
        }),
      );

      const client = createEventSourceClient({
        url,
        shouldReconnect: () => false,
        headers: { "Custom-Header": "bye" },
      });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(originalHeaders?.get("accept")).toBe("text/event-stream");
      expect(originalHeaders?.get("custom-header")).toBe("bye");
      expect(redirectedHeaders?.get("accept")).toBe("text/event-stream");
      expect(redirectedHeaders?.get("custom-header")).toBe("bye");
    });

    test("does not follow redirects if configured with redirect: 'error'", async () => {
      const url = "http://localhost/sse";
      let originalHeaders: Headers | undefined;
      let redirectedHeaders: Headers | undefined;

      server.use(
        http.get("http://localhost/redirected-sse", ({ request }) => {
          redirectedHeaders = request.headers;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
        http.get(url, ({ request }) => {
          originalHeaders = request.headers;
          return Response.redirect("http://localhost/redirected-sse");
        }),
      );

      const client = createEventSourceClient({
        url,
        redirect: "error",
        shouldReconnect: () => false,
      });
      const errorPromise = new Promise<Error>((resolve) => {
        client.onError = (error) => resolve(error);
      });
      client.connect();
      const error = await errorPromise;

      expect(originalHeaders?.get("accept")).toBe("text/event-stream");
      expect(redirectedHeaders).toBeUndefined();
      expect(error.message).toMatch(/failed to fetch/i);
    });
  });

  describe("onConnect handler", () => {
    test("calls onConnect when connection opens (constructor option)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      let connected = false;
      const connectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          onConnect: () => {
            connected = true;
            resolve();
          },
          shouldReconnect: () => false,
        });
        client.connect();
      });

      await connectPromise;
      expect(connected).toBe(true);
    });

    test("calls onConnect when connection opens (setter)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      const connectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({ url, shouldReconnect: () => false });
        client.onConnect = resolve;
        client.connect();
      });

      await connectPromise;
    });

    test("does not call onConnect for error responses", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => new Response(null, { status: 503 })));

      let connectCalled = false;
      const disconnectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          onConnect: () => {
            connectCalled = true;
          },
          shouldReconnect: () => false,
          onDisconnect: resolve,
        });
        client.connect();
      });

      await disconnectPromise;
      expect(connectCalled).toBe(false);
    });
  });

  describe("onDisconnect handler", () => {
    test("calls onDisconnect when server returns 204 (constructor option)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => new Response(null, { status: 204 })));

      let disconnected = false;
      const disconnectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          onDisconnect: () => {
            disconnected = true;
            resolve();
          },
        });
        client.connect();
      });

      await disconnectPromise;
      expect(disconnected).toBe(true);
    });

    test("calls onDisconnect when shouldReconnect returns false (setter)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => new Response(null, { status: 403 })));

      const disconnectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({ url, shouldReconnect: () => false });
        client.onDisconnect = resolve;
        client.connect();
      });

      await disconnectPromise;
    });

    test("does not call onDisconnect when close() is called explicitly", async () => {
      const url = "http://localhost/sse";
      server.use(
        http.get(url, () =>
          sseResponse(
            new ReadableStream({
              start() {
                // never ends
              },
            }),
          ),
        ),
      );

      let disconnectCalled = false;
      const client = createEventSourceClient({
        url,
        onDisconnect: () => {
          disconnectCalled = true;
        },
      });

      const connectPromise = new Promise<void>((resolve) => {
        client.onConnect = resolve;
      });
      client.connect();
      await connectPromise;
      client.close();

      await sleep(30);
      expect(disconnectCalled).toBe(false);
    });
  });

  describe("onMessage handler", () => {
    test("delivers parsed events via onMessage (constructor option)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf("event: update\nid: 7\ndata: hello world\n\n"))));

      const messagePromise = new Promise<EventSourceMessage>((resolve) => {
        const client = createEventSourceClient({
          url,
          onMessage: resolve,
          shouldReconnect: () => false,
        });
        client.connect();
      });

      const message = await messagePromise;
      expect(message.data).toBe("hello world");
      expect(message.type).toBe("update");
      expect(message.id).toBe("7");
    });

    test("delivers parsed events via onMessage (setter)", async () => {
      const url = "http://localhost/sse";
      server.use(http.post(url, () => sseResponse(streamOf('data: {"key":42}\n\n'))));

      const client = createEventSourceClient({ url, method: "POST", shouldReconnect: () => false });
      const messagePromise = new Promise<EventSourceMessage>((resolve) => {
        client.onMessage = resolve;
      });
      client.connect();

      const message = await messagePromise;
      expect(JSON.parse(message.data)).toMatchObject({ key: 42 });
    });

    test("delivers multiple events in order", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf("data: one\n\ndata: two\n\ndata: three\n\n"))));

      const client = createEventSourceClient({ url, shouldReconnect: () => false });
      const messages: string[] = [];

      const donePromise = new Promise<void>((resolve) => {
        client.onMessage = (m) => {
          messages.push(m.data);
          if (messages.length === 3) resolve();
        };
      });
      client.connect();
      await donePromise;

      expect(messages).toEqual(["one", "two", "three"]);
    });
  });

  describe("readyState", () => {
    test("starts as CLOSED", () => {
      const client = createEventSourceClient({ url: "http://localhost/sse" });
      expect(client.readyState).toBe(ReadyState.CLOSED);
    });

    test("becomes CONNECTING synchronously after connect()", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      const client = createEventSourceClient({ url, shouldReconnect: () => false });
      client.connect();

      // readyState transitions synchronously before the first await
      expect(client.readyState).toBe(ReadyState.CONNECTING);

      await new Promise<void>((resolve) => {
        client.onDisconnect = resolve;
      });
    });

    test("becomes OPEN when onConnect fires", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      let stateOnConnect: ReadyState | undefined;
      const client = createEventSourceClient({ url, shouldReconnect: () => false });

      await new Promise<void>((resolve) => {
        client.onConnect = () => {
          stateOnConnect = client.readyState;
          resolve();
        };
        client.connect();
      });

      expect(stateOnConnect).toBe(ReadyState.OPEN);
    });

    test("returns to CLOSED when onDisconnect fires", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => new Response(null, { status: 204 })));

      let stateOnDisconnect: ReadyState | undefined;
      const client = createEventSourceClient({ url });

      await new Promise<void>((resolve) => {
        client.onDisconnect = () => {
          stateOnDisconnect = client.readyState;
          resolve();
        };
        client.connect();
      });

      expect(stateOnDisconnect).toBe(ReadyState.CLOSED);
    });

    test("returns to CLOSED after close()", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(new ReadableStream({ start() {} }))));

      const client = createEventSourceClient({ url });
      await new Promise<void>((resolve) => {
        client.onConnect = resolve;
        client.connect();
      });

      expect(client.readyState).toBe(ReadyState.OPEN);
      client.close();
      expect(client.readyState).toBe(ReadyState.CLOSED);
    });
  });

  describe("onError handler", () => {
    test("calls onError on a network error (constructor option)", async () => {
      const url = "http://localhost/sse";
      const errors: Error[] = [];

      server.use(http.get(url, () => HttpResponse.error()));

      await new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          onError: (e) => errors.push(e),
          shouldReconnect: () => false,
          onDisconnect: resolve,
        });
        client.connect();
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(Error);
    });

    test("calls onError when calculateReconnectDelay returns an out-of-range value", async () => {
      const url = "http://localhost/sse";
      const errors: Error[] = [];

      // retry: 5 sets serverReconnectionTime to 5 ms so the fallback delay is fast
      server.use(http.get(url, () => sseResponse(streamOf("retry: 5\ndata: hi\n\n"))));

      // calculateReconnectDelay is only invoked when shouldReconnect returns true;
      // resolve inside it, then close() to cancel the scheduled timer.
      let client!: EventSourceClient;
      await new Promise<void>((resolve) => {
        client = createEventSourceClient({
          url,
          onError: (e) => errors.push(e),
          calculateReconnectDelay: () => {
            resolve();
            return 0;
          }, // below the minimum of 1
          shouldReconnect: () => true,
        });
        client.connect();
      });
      client.close();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(ValueOutOfRangeError);
    });

    test("does not call onError for HTTP error responses", async () => {
      const url = "http://localhost/sse";
      const errors: Error[] = [];

      server.use(http.get(url, () => new Response(null, { status: 503 })));

      await new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          onError: (e) => errors.push(e),
          shouldReconnect: () => false,
          onDisconnect: resolve,
        });
        client.connect();
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe("onComment handler", () => {
    test("calls onComment for SSE comment lines (constructor option)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf(": keep-alive\ndata: hi\n\n"))));

      const comments: string[] = [];
      const client = createEventSourceClient({
        url,
        onComment: (c) => comments.push(c),
        shouldReconnect: () => false,
      });
      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(comments).toEqual(["keep-alive"]);
    });

    test("calls onComment for SSE comment lines (setter)", async () => {
      const url = "http://localhost/sse";
      server.use(http.get(url, () => sseResponse(streamOf(": ping\ndata: hi\n\n"))));

      const comments: string[] = [];
      const client = createEventSourceClient({ url, shouldReconnect: () => false });
      client.onComment = (c) => comments.push(c);

      const messagePromise = new Promise<void>((resolve) => {
        client.onMessage = () => resolve();
      });
      client.connect();
      await messagePromise;

      expect(comments).toEqual(["ping"]);
    });
  });

  describe("HTTP status handling", () => {
    test("204 response triggers disconnect without reconnection", async () => {
      const url = "http://localhost/sse";
      let requestCount = 0;

      server.use(
        http.get(url, () => {
          requestCount++;
          return new Response(null, { status: 204 });
        }),
      );

      const disconnectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({ url, onDisconnect: resolve });
        client.connect();
      });

      await disconnectPromise;
      expect(requestCount).toBe(1);
    });

    test("4xx response is passed as status to shouldReconnect", async () => {
      const url = "http://localhost/sse";
      let capturedStatus: number | undefined;

      server.use(http.get(url, () => new Response(null, { status: 403 })));

      const disconnectPromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          shouldReconnect: (state) => {
            capturedStatus = state.status;
            return false;
          },
          onDisconnect: resolve,
        });
        client.connect();
      });

      await disconnectPromise;
      expect(capturedStatus).toBe(403);
    });

    test("5xx response triggers reconnect by default", async () => {
      const url = "http://localhost/sse";
      let requestCount = 0;

      server.use(
        http.get(url, () => {
          requestCount++;
          if (requestCount === 1) return new Response(null, { status: 503 });
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const messagePromise = new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          calculateReconnectDelay: () => 1,
          shouldReconnect: (state) => state.attempt <= 1,
          onMessage: () => resolve(),
        });
        client.connect();
      });

      await messagePromise;
      expect(requestCount).toBe(2);
    });
  });

  describe("reconnection", () => {
    test("reconnects automatically when stream ends and shouldReconnect returns true", async () => {
      const url = "http://localhost/sse";
      // reconnectAttempt resets to 0 after each successful connection, so state.attempt
      // is always 1 for success-based reconnects. Count onConnect calls instead.
      let connectCount = 0;

      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      await new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          calculateReconnectDelay: () => 1,
          onConnect: () => connectCount++,
          shouldReconnect: () => {
            if (connectCount >= 3) {
              resolve();
              return false;
            }
            return true;
          },
        });
        client.connect();
      });

      expect(connectCount).toBe(3);
    });

    test("passes incrementing attempt count to shouldReconnect on consecutive failures", async () => {
      const url = "http://localhost/sse";
      const attempts: number[] = [];

      // Error responses do not reset reconnectAttempt (only successful connections do),
      // so the attempt counter accumulates across retries.
      server.use(http.get(url, () => new Response(null, { status: 503 })));

      await new Promise<void>((resolve) => {
        const client = createEventSourceClient({
          url,
          calculateReconnectDelay: () => 1,
          shouldReconnect: (state) => {
            attempts.push(state.attempt);
            if (state.attempt >= 3) {
              resolve();
              return false;
            }
            return true;
          },
        });
        client.connect();
      });

      expect(attempts).toEqual([1, 2, 3]);
    });

    test("resets attempt counter when connect() is called on a closed client", async () => {
      const url = "http://localhost/sse";
      const attempts: number[] = [];

      server.use(http.get(url, () => new Response(null, { status: 503 })));

      const client = createEventSourceClient({
        url,
        shouldReconnect: (state) => {
          attempts.push(state.attempt);
          return false; // disconnect immediately on first attempt
        },
      });

      const cycle = () =>
        new Promise<void>((resolve) => {
          client.onDisconnect = resolve;
          client.connect();
        });

      await cycle();
      await cycle();

      // Each fresh connect() resets the attempt counter to 0, so both cycles see attempt=1
      expect(attempts).toEqual([1, 1]);
    });

    test("passes serverReconnectionTime from SSE retry field to calculateReconnectDelay", async () => {
      const url = "http://localhost/sse";
      let capturedServerReconnectionTime: number | undefined;

      server.use(http.get(url, () => sseResponse(streamOf("retry: 5000\ndata: hi\n\n"))));

      // Resolve inside calculateReconnectDelay so we can capture the state before
      // returning a large delay, then immediately close() to cancel the pending timer.
      let client!: EventSourceClient;
      await new Promise<void>((resolve) => {
        client = createEventSourceClient({
          url,
          calculateReconnectDelay: (state) => {
            capturedServerReconnectionTime = state.serverReconnectionTime;
            resolve();
            return 10_000;
          },
          shouldReconnect: () => true,
        });
        client.connect();
      });
      client.close();

      expect(capturedServerReconnectionTime).toBe(5000);
    });

    test("passes reconnection state to calculateReconnectDelay", async () => {
      const url = "http://localhost/sse";
      let capturedState: { attempt: number; serverReconnectionTime: number } | undefined;

      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      let client!: EventSourceClient;
      await new Promise<void>((resolve) => {
        client = createEventSourceClient({
          url,
          calculateReconnectDelay: (state) => {
            capturedState = state;
            resolve();
            return 10_000;
          },
          shouldReconnect: () => true,
        });
        client.connect();
      });
      client.close();

      expect(capturedState).toMatchObject({ attempt: 1, serverReconnectionTime: 2000 });
    });

    test.each([
      ["zero", 0],
      ["negative", -1],
      ["above the one-hour maximum", 3_600_001],
      ["Infinity", Infinity],
      ["NaN", NaN],
    ])(
      "calls onError and falls back to serverReconnectionTime when delay is %s",
      async (_label, invalidDelay) => {
        const url = "http://localhost/sse";
        const errors: Error[] = [];

        // retry: 5 keeps the serverReconnectionTime fallback fast
        server.use(http.get(url, () => sseResponse(streamOf("retry: 5\ndata: hi\n\n"))));

        let client!: EventSourceClient;
        await new Promise<void>((resolve) => {
          client = createEventSourceClient({
            url,
            onError: (e) => errors.push(e),
            calculateReconnectDelay: () => {
              resolve();
              return invalidDelay;
            },
            shouldReconnect: () => true,
          });
          client.connect();
        });
        client.close();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(ValueOutOfRangeError);
      },
    );

    test.each([
      ["minimum (1 ms)", 1],
      ["maximum (1 hour)", 3_600_000],
    ])("does not call onError when delay is at the valid boundary: %s", async (_label, validDelay) => {
      const url = "http://localhost/sse";
      const errors: Error[] = [];

      server.use(http.get(url, () => sseResponse(streamOf("data: hi\n\n"))));

      let client!: EventSourceClient;
      await new Promise<void>((resolve) => {
        client = createEventSourceClient({
          url,
          onError: (e) => errors.push(e),
          calculateReconnectDelay: () => {
            resolve();
            return validDelay;
          },
          shouldReconnect: () => true,
        });
        client.connect();
      });
      client.close();

      expect(errors).toHaveLength(0);
    });

    test("connect() is a no-op when a connection is already in progress", async () => {
      const url = "http://localhost/sse";
      let requestCount = 0;

      server.use(
        http.get(url, () => {
          requestCount++;
          return sseResponse(streamOf("data: hi\n\n"));
        }),
      );

      const client = createEventSourceClient({ url, shouldReconnect: () => false });
      const connectPromise = new Promise<void>((resolve) => {
        client.onConnect = resolve;
      });

      client.connect();
      client.connect(); // ignored — already connecting
      client.connect(); // ignored

      await connectPromise;
      expect(requestCount).toBe(1);
    });
  });

  describe("close()", () => {
    test("close() prevents a scheduled reconnect from firing", async () => {
      const url = "http://localhost/sse";
      let requestCount = 0;

      server.use(
        http.get(url, () => {
          requestCount++;
          return new Response(null, { status: 503 });
        }),
      );

      const client = createEventSourceClient({
        url,
        calculateReconnectDelay: () => 200,
        shouldReconnect: () => true,
      });

      client.connect();
      await sleep(30); // let the first failed request complete
      client.close();
      await sleep(250); // wait past the reconnect delay

      expect(requestCount).toBe(1);
    });

    test("close() allows a subsequent connect() to re-establish the connection", async () => {
      const url = "http://localhost/sse";

      server.use(
        http.get(url, () =>
          sseResponse(
            new ReadableStream({
              start() {
                // never ends
              },
            }),
          ),
        ),
      );

      const client = createEventSourceClient({ url });

      const firstConnect = new Promise<void>((resolve) => {
        client.onConnect = resolve;
      });
      client.connect();
      await firstConnect;

      client.close();
      await sleep(10);

      const secondConnect = new Promise<void>((resolve) => {
        client.onConnect = resolve;
      });
      client.connect();
      await secondConnect;
    });
  });

  describe("invalid constructor options", () => {
    test("throws when onMessage is not a function", () => {
      expect(() => createEventSourceClient({ url: "http://localhost/sse", onMessage: "bad" as any })).toThrow(
        "onMessage must be a function",
      );
    });

    test("throws when onComment is not a function", () => {
      expect(() => createEventSourceClient({ url: "http://localhost/sse", onComment: 42 as any })).toThrow(
        "onComment must be a function",
      );
    });

    test("throws when onConnect is not a function", () => {
      expect(() => createEventSourceClient({ url: "http://localhost/sse", onConnect: {} as any })).toThrow(
        "onConnect must be a function",
      );
    });

    test("throws when onDisconnect is not a function", () => {
      expect(() =>
        createEventSourceClient({ url: "http://localhost/sse", onDisconnect: true as any }),
      ).toThrow("onDisconnect must be a function");
    });

    test("throws when shouldReconnect is not a function", () => {
      expect(() =>
        createEventSourceClient({ url: "http://localhost/sse", shouldReconnect: "yes" as any }),
      ).toThrow("shouldReconnect must be a function");
    });

    test("throws when calculateReconnectDelay is not a function", () => {
      expect(() =>
        createEventSourceClient({ url: "http://localhost/sse", calculateReconnectDelay: 1000 as any }),
      ).toThrow("calculateReconnectDelay must be a function");
    });

    test("throws when onError is not a function", () => {
      expect(() => createEventSourceClient({ url: "http://localhost/sse", onError: "bad" as any })).toThrow(
        "onError must be a function",
      );
    });
  });
});
