// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from "vitest";
import { StrictMode } from "react";
import { render, cleanup } from "@testing-library/react";
import { ConfigDirectorProvider } from "../src/client/ConfigDirectorProvider";

type FakeClient = {
  initialize: ReturnType<typeof vi.fn>;
  updateContext: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  getValue: ReturnType<typeof vi.fn>;
  isReady: boolean;
};

const createdClients: FakeClient[] = [];

vi.mock("@js-browser-client/index", () => ({
  createBrowserClient: vi.fn(() => {
    const client: FakeClient = {
      initialize: vi.fn(async () => {}),
      updateContext: vi.fn(async () => {}),
      on: vi.fn(),
      off: vi.fn(),
      dispose: vi.fn(),
      getValue: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
      isReady: true,
    };
    createdClients.push(client);
    return client;
  }),
  createDefaultLogger: vi.fn(() => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  })),
}));

vi.mock("../src/client/logger", () => ({
  createConsoleLogger: vi.fn(() => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  })),
}));

describe("client ConfigDirectorProvider lifecycle", () => {
  afterEach(() => {
    cleanup();
    createdClients.length = 0;
  });

  test("disposes every client it creates under StrictMode double-mounting", async () => {
    const view = render(
      <StrictMode>
        <ConfigDirectorProvider sdkKey="dummy-key">
          <div />
        </ConfigDirectorProvider>
      </StrictMode>,
    );

    await vi.waitFor(() => expect(createdClients.length).toBeGreaterThanOrEqual(2));

    view.unmount();

    const undisposed = createdClients.filter((c) => c.dispose.mock.calls.length === 0);
    expect(undisposed).toHaveLength(0);
  });

  test("creates and disposes exactly one client for a plain mount/unmount", async () => {
    const view = render(
      <ConfigDirectorProvider sdkKey="dummy-key">
        <div />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(createdClients).toHaveLength(1));

    view.unmount();

    expect(createdClients).toHaveLength(1);
    expect(createdClients[0].dispose).toHaveBeenCalledTimes(1);
  });
});
