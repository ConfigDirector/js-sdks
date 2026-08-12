import { beforeEach, describe, expect, test, jest } from "@jest/globals";

jest.mock("@js-client-core/telemetry", () => ({
  ClientTelemetryEventCollector: jest.fn(),
}));

import { ClientTelemetryEventCollector } from "@js-client-core/telemetry";
import { ReactNativeTelemetryClient } from "../src/ReactNativeTelemetryClient";
import { createStubbedLogger } from "./helpers";
import type { TelemetryValue } from "@shared/telemetry/utils";
import { generateValueId } from "../src/value-id-generator";

const MockCollector = jest.mocked(ClientTelemetryEventCollector);

type CollectorMock = {
  evaluatedConfig: jest.Mock;
  updateContext: jest.Mock;
  close: jest.Mock;
};

const BASE_URL = new URL("https://example.com");
const stubUrlFactory = (input: string, base?: { toString(): string }) => new URL(input, base?.toString());
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
  new ReactNativeTelemetryClient({
    sdkKey: "sdk-key",
    sdkIdentity: { sdkName: "tests", sdkVersion: "1.3.4" },
    baseUrl: BASE_URL,
    logger,
    urlFactory: stubUrlFactory as any,
  });

describe("ReactNativeTelemetryClient", () => {
  describe("constructor", () => {
    test("forwards the SDK identity to the collector", () => {
      makeClient();

      expect(MockCollector).toHaveBeenCalledWith(
        expect.objectContaining({
          sdkKey: "sdk-key",
          sdkIdentity: { sdkName: "tests", sdkVersion: "1.3.4" },
        }),
      );
    });
  });

  describe("evaluatedConfig", () => {
    test("passes string values through unchanged", () => {
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
        expect.objectContaining({ defaultValue: { value: "off" }, evaluatedValue: { value: "on" } }),
      );
    });

    test("converts number values to strings", () => {
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
        expect.objectContaining({ defaultValue: { value: "30" }, evaluatedValue: { value: "60" } }),
      );
    });

    test("hashes JSON values as an 8-character hex string", () => {
      makeClient().evaluatedConfig({
        key: "config",
        type: "json",
        defaultValue: {},
        evaluatedValue: { enabled: true, threshold: 0.5 },
        evaluatedValueId: generateValueId(JSON.stringify({ enabled: true, threshold: 0.5 })),
        requestedType: "json",
        usedDefault: false,
        evaluationReason: "config-state-missing",
      });

      const call = collectorMock.evaluatedConfig.mock.calls[0]?.[0] as {
        evaluatedValue: TelemetryValue;
        defaultValue: TelemetryValue;
      };
      expect(call.evaluatedValue.valueId).toMatch(/^[0-9a-zA-Z]{22}$/);
      expect(call.defaultValue.valueId).toBeUndefined();
    });

    test("uses the value ID for object values when type is not provided", () => {
      makeClient().evaluatedConfig({
        key: "config",
        defaultValue: { threshold: 0.5 },
        evaluatedValue: { enabled: true, threshold: 0.8 },
        evaluatedValueId: generateValueId(JSON.stringify({ enabled: true, threshold: 0.5 })),
        requestedType: "object",
        usedDefault: false,
        evaluationReason: "config-state-missing",
      });

      const call = collectorMock.evaluatedConfig.mock.calls[0]?.[0] as {
        evaluatedValue: TelemetryValue;
        defaultValue: TelemetryValue;
      };
      expect(call.defaultValue.valueId).toBeUndefined();
      expect(call.evaluatedValue.valueId).toMatch(/^[0-9a-zA-Z]{22}$/);
    });

    test("preserves all non-value fields in the sanitized event", () => {
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

  test("delegates updateContext to the collector", async () => {
    const ctx = { id: "u-1" };
    await makeClient().updateContext(ctx);
    expect(collectorMock.updateContext).toHaveBeenCalledWith(ctx);
  });

  test("delegates close to the collector", async () => {
    await makeClient().close();
    expect(collectorMock.close).toHaveBeenCalled();
  });
});
