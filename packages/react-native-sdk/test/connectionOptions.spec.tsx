import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { ConfigDirectorProvider } from "../src/provider";
import { createReactNativeClient } from "../src/client";
import { createStubbedLogger } from "./helpers";

jest.mock("../src/client", () => ({
  createReactNativeClient: jest.fn(() => ({
    initialize: jest.fn(async () => {}),
    updateContext: jest.fn(async () => {}),
    on: jest.fn(),
    off: jest.fn(),
    dispose: jest.fn(),
    pauseNetwork: jest.fn(),
    resumeNetwork: jest.fn(async () => {}),
    isReady: true,
  })),
}));

const logger = createStubbedLogger();

const connectionOptionsOfLastClient = () =>
  (jest.mocked(createReactNativeClient).mock.lastCall?.[1] as { connection: Record<string, unknown> }).connection;

describe("connection options", () => {
  afterEach(() => {
    jest.mocked(createReactNativeClient).mockClear();
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
        <></>
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
        <></>
      </ConfigDirectorProvider>,
    );

    expect(jest.mocked(createReactNativeClient).mock.lastCall?.[0]).toBeUndefined();
    expect(connectionOptionsOfLastClient()).toEqual({
      mode: "offline",
      values: { "new-checkout": true, "max-items": 20 },
    });
  });

  test("ConfigDirectorProvider passes the caching options through to the client", () => {
    const caching = { enabled: true, provider: { read: () => undefined, write: () => {}, remove: () => {}, sizeLimit: () => 10 } };

    render(
      <ConfigDirectorProvider sdkKey="dummy-key" logger={logger} caching={caching}>
        <></>
      </ConfigDirectorProvider>,
    );

    expect((jest.mocked(createReactNativeClient).mock.lastCall?.[1] as { caching: unknown }).caching).toBe(caching);
  });
});
