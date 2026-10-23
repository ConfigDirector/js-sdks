import { afterEach, describe, test, expect, vi } from "vitest";
import { createBrowserClient } from "@js-browser-client/index";
import type * as browserClient from "@js-browser-client/index";
import { createClientFromPluginOptions } from "../src/client";
import { createStubbedLogger } from "./helpers";

vi.mock("@js-browser-client/index", async (importOriginal) => ({
  ...(await importOriginal<typeof browserClient>()),
  createBrowserClient: vi.fn(() => ({
    initialize: vi.fn(async () => {}),
    on: vi.fn(),
    off: vi.fn(),
    dispose: vi.fn(),
    isReady: true,
  })),
}));

const logger = createStubbedLogger();

const connectionOptionsOfLastClient = () =>
  (vi.mocked(createBrowserClient).mock.lastCall?.[2] as { connection: Record<string, unknown> }).connection;

describe("createClientFromPluginOptions", () => {
  afterEach(() => {
    vi.mocked(createBrowserClient).mockClear();
  });

  test("passes mode and pollingInterval through to the browser client", () => {
    createClientFromPluginOptions({
      sdkKey: "dummy-key",
      logger,
      url: "https://proxy.test/",
      timeout: 5_000,
      mode: "polling",
      pollingInterval: 120,
    });

    expect(connectionOptionsOfLastClient()).toEqual({
      url: "https://proxy.test/",
      timeout: 5_000,
      mode: "polling",
      pollingInterval: 120,
    });
  });

  test("passes offline values through to the browser client without a key", () => {
    createClientFromPluginOptions({ logger, mode: "offline", values: { "new-checkout": true, "max-items": 20 } });

    expect(vi.mocked(createBrowserClient).mock.lastCall?.[0]).toBeUndefined();
    expect(connectionOptionsOfLastClient()).toEqual({
      mode: "offline",
      values: { "new-checkout": true, "max-items": 20 },
    });
  });

  test("passes the caching options through to the browser client", () => {
    const caching = { enabled: true, provider: { read: () => undefined, write: () => {}, remove: () => {}, sizeLimit: () => 10 } };

    createClientFromPluginOptions({ sdkKey: "dummy-key", logger, caching });

    expect((vi.mocked(createBrowserClient).mock.lastCall?.[2] as { caching: unknown }).caching).toBe(caching);
  });
});
