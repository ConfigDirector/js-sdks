import { defineBrowserCommand } from "@vitest/browser";
import { defineNetworkFixture } from "@msw/playwright";
import { http, HttpResponse } from "msw";
import type { BrowserContext, Page } from "playwright";
import type { BrowserCommandContext } from "vitest/node";

type PlaywrightCtx = BrowserCommandContext & { page: Page; context: BrowserContext };

type NetworkState = {
  network: ReturnType<typeof defineNetworkFixture>;
  payloads: unknown[];
  requestReceived: boolean;
};

export type HandlerDescriptor = {
  url: string;
  method?: string; // defaults to 'post'
  status?: number; // defaults to 200
  responseBody?: object; // defaults to {}
};

/** A single SSE message to stream, with an optional delay before it is sent. */
export type SseMessage = { delay?: number; data: object };

const networkStateMap = new WeakMap<Page, NetworkState>();

/** Initializes the Playwright-level network fixture. Call once in beforeAll. */
export const mswSetup = defineBrowserCommand(async (ctx: PlaywrightCtx) => {
  const network = defineNetworkFixture({ context: ctx.context, handlers: [] });
  networkStateMap.set(ctx.page, { network, payloads: [], requestReceived: false });
  await network.enable();
});

export const mswTeardown = defineBrowserCommand(async (ctx: PlaywrightCtx) => {
  const state = networkStateMap.get(ctx.page);
  if (state) {
    await state.network.disable();
    networkStateMap.delete(ctx.page);
  }
});

/**
 * Replaces all active handlers with ones built from the given descriptors, and resets
 * captured state (payloads + requestReceived). Call in beforeEach or at the top of a test.
 *
 * Each handler sets requestReceived = true on any hit. 2xx handlers additionally capture
 * the request body in the payloads list (readable via mswGetPayloads).
 */
export const mswUseHandlers = defineBrowserCommand(
  async (ctx: PlaywrightCtx, ...descriptors: HandlerDescriptor[]) => {
    const state = networkStateMap.get(ctx.page);
    if (!state) return;

    state.payloads.length = 0;
    state.requestReceived = false;

    const handlers = descriptors.map(({ url, method = "post", status = 200, responseBody }) =>
      (http as Record<string, typeof http.post>)[method.toLowerCase()](
        url,
        async ({ request }) => {
          state.requestReceived = true;
          if (status >= 200 && status < 300) {
            state.payloads.push(await request.json());
          }
          return HttpResponse.json(responseBody ?? {}, { status });
        },
      ),
    );

    state.network.resetHandlers(...handlers);
  },
);

export const mswGetPayloads = defineBrowserCommand(async (ctx: PlaywrightCtx) => {
  return [...(networkStateMap.get(ctx.page)?.payloads ?? [])];
});

/** Returns true if any handler installed by the last mswUseHandlers call was hit. */
export const mswWasRequestReceived = defineBrowserCommand(async (ctx: PlaywrightCtx) => {
  return networkStateMap.get(ctx.page)?.requestReceived ?? false;
});

/**
 * Registers an SSE handler for POST requests to `url` and resets captured state.
 *
 * `responses` is a per-request array of messages to stream. The first request uses
 * `responses[0]`, the second uses `responses[1]`, and so on. If there are more requests
 * than entries, the last entry is reused. Each message may carry an optional `delay` (ms)
 * before it is enqueued into the stream.
 *
 * `startDelay` (ms), if provided, is awaited before the response is returned, simulating
 * a slow server.
 */
export const mswUseSseHandler = defineBrowserCommand(
  async (ctx: PlaywrightCtx, url: string, responses: SseMessage[][], startDelay?: number) => {
    const state = networkStateMap.get(ctx.page);
    if (!state) return;

    state.payloads.length = 0;
    state.requestReceived = false;
    let requestCount = 0;

    const encoder = new TextEncoder();

    const handler = http.post(url, async ({ request }) => {
      state.requestReceived = true;
      state.payloads.push(await request.json());

      if (startDelay != null) {
        await new Promise<void>((resolve) => setTimeout(resolve, startDelay));
      }

      const messages = responses[requestCount] ?? responses[responses.length - 1] ?? [];
      requestCount++;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let maxDelay = 0;

          for (const msg of messages) {
            const encoded = encoder.encode(`data: ${JSON.stringify(msg.data)}\n\n`);
            const delay = msg.delay ?? 0;
            if (delay > 0) {
              maxDelay = Math.max(maxDelay, delay);
              setTimeout(() => controller.enqueue(encoded), delay);
            } else {
              controller.enqueue(encoded);
            }
          }

          // @msw/playwright reads the entire body via response.arrayBuffer() before
          // calling route.fulfill(). The stream must be closed so that call can resolve.
          // For delayed messages the stream closes after the last one fires.
          if (maxDelay > 0) {
            setTimeout(() => controller.close(), maxDelay + 1);
          } else {
            controller.close();
          }
        },
      });

      return new HttpResponse(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    });

    state.network.resetHandlers(handler);
  },
);
