import { afterEach, describe, test, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ConfigDirectorProvider } from "../src/provider";
import { withProvider } from "../src/withProvider";
import { createClient } from "../src/client";
import { createStubbedLogger } from "./helpers";

vi.mock("../src/client", () => ({
  createClient: vi.fn(() => ({
    initialize: vi.fn(async () => {}),
    updateContext: vi.fn(async () => {}),
    on: vi.fn(),
    off: vi.fn(),
    dispose: vi.fn(),
    isReady: true,
  })),
}));

const logger = createStubbedLogger();

const connectionOptionsOfLastClient = () =>
  (vi.mocked(createClient).mock.lastCall?.[1] as { connection: Record<string, unknown> }).connection;

describe("connection options", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(createClient).mockClear();
  });

  test("ConfigDirectorProvider passes mode and pollingInterval through to the client", () => {
    render(
      <ConfigDirectorProvider
        sdkKey="dummy-key"
        logger={logger}
        url="https://proxy.test/"
        timeout={5_000}
        mode="polling"
        pollingInterval={120}>
        <div />
      </ConfigDirectorProvider>,
    );

    expect(connectionOptionsOfLastClient()).toEqual({
      url: "https://proxy.test/",
      timeout: 5_000,
      mode: "polling",
      pollingInterval: 120,
    });
  });

  test("ConfigDirectorProvider passes offline values through to the client without a key", () => {
    render(
      <ConfigDirectorProvider logger={logger} mode="offline" values={{ "new-checkout": true, "max-items": 20 }}>
        <div />
      </ConfigDirectorProvider>,
    );

    expect(vi.mocked(createClient).mock.lastCall?.[0]).toBeUndefined();
    expect(connectionOptionsOfLastClient()).toEqual({
      mode: "offline",
      values: { "new-checkout": true, "max-items": 20 },
    });
  });

  test("withProvider passes mode and pollingInterval through to the client", async () => {
    await withProvider({
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

  test("ConfigDirectorProvider passes the caching options through to the client", () => {
    const caching = { enabled: true, provider: { read: () => undefined, write: () => {}, remove: () => {}, sizeLimit: () => 10 } };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger} caching={caching}>
        <div />
      </ConfigDirectorProvider>,
    );

    expect((vi.mocked(createClient).mock.lastCall?.[1] as { caching: unknown }).caching).toBe(caching);
  });
});
