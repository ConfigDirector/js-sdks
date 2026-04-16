import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@js-client-core/telemetry", () => ({
  ClientTelemetryEventCollector: jest.fn(),
}));

import { ClientTelemetryEventCollector } from "@js-client-core/telemetry";
import { ReactNativeTelemetryClient } from "../src/ReactNativeTelemetryClient";
import { createStubbedLogger } from "./helpers";

const MockCollector = jest.mocked(ClientTelemetryEventCollector);

type CollectorMock = {
  evaluatedConfig: jest.Mock;
  updateContext: jest.Mock;
  close: jest.Mock;
};

const BASE_URL = new URL("https://example.com");
const stubUrlFactory = (input: string, base?: { toString(): string }) =>
  new URL(input, base?.toString());
const logger = createStubbedLogger();

let collectorMock: CollectorMock;

beforeEach(() => {
  collectorMock = {
    evaluatedConfig: jest.fn(),
    updateContext: jest.fn().mockImplementation(() => Promise.resolve()),
    close: jest.fn().mockImplementation(() => Promise.resolve()),
  };
  MockCollector.mockImplementation(() => collectorMock as any);
});

const makeClient = () =>
  new ReactNativeTelemetryClient("sdk-key", BASE_URL, logger, stubUrlFactory as any);

describe("ReactNativeTelemetryClient", () => {
  describe("evaluatedConfig", () => {
    it("passes string values through unchanged", () => {
      makeClient().evaluatedConfig({
        key: "flag",
        type: "string",
        defaultValue: "off",
        evaluatedValue: "on",
        requestedType: "string",
        usedDefault: false,
        evaluationReason: "found-match",
      });

      expect(collectorMock.evaluatedConfig).toHaveBeenCalledWith(
        expect.objectContaining({ defaultValue: "off", evaluatedValue: "on" }),
      );
    });

    it("converts number values to strings", () => {
      makeClient().evaluatedConfig({
        key: "timeout",
        type: "integer",
        defaultValue: 30,
        evaluatedValue: 60,
        requestedType: "integer",
        usedDefault: false,
        evaluationReason: "found-match",
      });

      expect(collectorMock.evaluatedConfig).toHaveBeenCalledWith(
        expect.objectContaining({ defaultValue: "30", evaluatedValue: "60" }),
      );
    });

    it("hashes JSON values as an 8-character hex string", () => {
      makeClient().evaluatedConfig({
        key: "config",
        type: "json",
        defaultValue: {},
        evaluatedValue: { enabled: true, threshold: 0.5 },
        requestedType: "json",
        usedDefault: false,
        evaluationReason: "config-state-missing",
      });

      const call = collectorMock.evaluatedConfig.mock.calls[0]?.[0] as {
        evaluatedValue: string;
        defaultValue: string;
      };
      expect(call.evaluatedValue).toMatch(/^[0-9a-f]{8}$/);
      expect(call.defaultValue).toMatch(/^[0-9a-f]{8}$/);
    });

    it("preserves all non-value fields in the sanitized event", () => {
      makeClient().evaluatedConfig({
        key: "feature",
        contextId: "ctx-1",
        type: "boolean",
        defaultValue: false,
        evaluatedValue: true,
        requestedType: "boolean",
        usedDefault: false,
        evaluationReason: "found-match",
      });

      expect(collectorMock.evaluatedConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "feature",
          contextId: "ctx-1",
          type: "boolean",
          requestedType: "boolean",
          usedDefault: false,
          evaluationReason: "found-match",
        }),
      );
    });
  });

  it("delegates updateContext to the collector", async () => {
    const ctx = { id: "u-1" };
    await makeClient().updateContext(ctx);
    expect(collectorMock.updateContext).toHaveBeenCalledWith(ctx);
  });

  it("delegates close to the collector", async () => {
    await makeClient().close();
    expect(collectorMock.close).toHaveBeenCalled();
  });
});
