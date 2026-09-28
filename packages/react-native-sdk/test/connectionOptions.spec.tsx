import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { ConfigDirectorProvider } from "../src/provider";
import { createClient } from "../src/client";
import { createStubbedLogger } from "./helpers";

jest.mock("../src/client", () => ({
  createClient: jest.fn(() => ({
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
  (jest.mocked(createClient).mock.lastCall?.[1] as { connection: Record<string, unknown> }).connection;

describe("connection options", () => {
  afterEach(() => {
    jest.mocked(createClient).mockClear();
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
});
