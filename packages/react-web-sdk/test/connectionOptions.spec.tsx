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
});
