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
});
