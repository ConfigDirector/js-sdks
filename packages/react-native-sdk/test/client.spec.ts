import { afterAll, afterEach, beforeAll, describe, expect, test, jest } from "@jest/globals";
import { NativeModules } from "react-native";
import { createClient } from "../src/client";
import { buildResponse, createStubbedLogger, full, message, SSE_URL } from "./helpers";

const logger = createStubbedLogger();

type ExpoGlobal = { expo?: { modules?: Record<string, unknown> } };

describe("createClient", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof globalThis, "fetch", any>>;
  const requests: { url: string; body: any }[] = [];

  beforeAll(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (url: any, init: any) => {
      requests.push({ url: url.toString(), body: init?.body ? JSON.parse(init.body) : undefined });
      if (url.toString().includes("telemetry")) {
        return Response.json({}, { status: 204 });
      }
      return buildResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(message(full()));
          },
        }),
      );
    });
  });

  afterEach(() => {
    requests.length = 0;
    delete NativeModules.RNDeviceInfo;
    delete (globalThis as ExpoGlobal).expo;
  });

  const connectRequestMetaContext = () =>
    requests.find((request) => request.url.startsWith(SSE_URL))?.body?.metaContext;

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  test("connects without a location global", async () => {
    expect(globalThis).not.toHaveProperty("location");

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    const connectRequest = requests.find((request) => request.url.startsWith(SSE_URL));
    expect(connectRequest?.body?.metaContext).toMatchObject({ sdkName: "react-native-sdk" });
    expect(connectRequest?.body?.metaContext?.host).toBeUndefined();

    client.dispose();
  });

  test("fills in the app name and version from react-native-device-info when metadata leaves them unset", async () => {
    NativeModules.RNDeviceInfo = { appName: "Robo Checkout", appVersion: "7.1.0" };

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(connectRequestMetaContext()).toMatchObject({ appName: "Robo Checkout", appVersion: "7.1.0" });

    client.dispose();
  });

  test("fills in the app name and version from expo-application when metadata leaves them unset", async () => {
    (globalThis as ExpoGlobal).expo = {
      modules: { ExpoApplication: { applicationName: "Expo Checkout", nativeApplicationVersion: "5.0.0" } },
    };

    const client = createClient("sdk-key", { logger });
    await client.initialize();

    expect(connectRequestMetaContext()).toMatchObject({ appName: "Expo Checkout", appVersion: "5.0.0" });

    client.dispose();
  });

  test("keeps the app name it was given and reads the version from the platform", async () => {
    NativeModules.RNDeviceInfo = { appName: "Robo Checkout", appVersion: "7.1.0" };

    const client = createClient("sdk-key", { logger, metadata: { appName: "Checkout" } });
    await client.initialize();

    expect(connectRequestMetaContext()).toMatchObject({ appName: "Checkout", appVersion: "7.1.0" });

    client.dispose();
  });

  test("keeps the app version it was given and reads the name from the platform", async () => {
    NativeModules.RNDeviceInfo = { appName: "Robo Checkout", appVersion: "7.1.0" };

    const client = createClient("sdk-key", { logger, metadata: { appVersion: "4.2.0" } });
    await client.initialize();

    expect(connectRequestMetaContext()).toMatchObject({ appName: "Robo Checkout", appVersion: "4.2.0" });

    client.dispose();
  });

  test("reports telemetry with the app name and version it read from the platform", async () => {
    NativeModules.RNDeviceInfo = { appName: "Robo Checkout", appVersion: "7.1.0" };

    const client = createClient("sdk-key", { logger });
    await client.initialize();
    client.getValue("dark-mode", false);
    client.dispose();

    await waitForTelemetryReport();
    const telemetryRequest = requests.find((request) => request.url.includes("telemetry"));
    expect(telemetryRequest?.body?.metaContext).toMatchObject({ appName: "Robo Checkout", appVersion: "7.1.0" });
  });

  test("says which of the app name and version it could not find", async () => {
    const infoMessages: string[] = [];
    const recordingLogger = { ...logger, info: (message: string) => infoMessages.push(message) };

    const client = createClient("sdk-key", { logger: recordingLogger, metadata: { appName: "Checkout" } });
    await client.initialize();

    expect(connectRequestMetaContext()).toMatchObject({ appName: "Checkout" });
    expect(connectRequestMetaContext()).not.toHaveProperty("appVersion");
    expect(infoMessages.filter((message) => message.includes("could not find an app version"))).toHaveLength(1);
    expect(infoMessages.filter((message) => message.includes("app name"))).toHaveLength(0);

    client.dispose();
  });

  test("says nothing when it found both the app name and version", async () => {
    NativeModules.RNDeviceInfo = { appName: "Robo Checkout", appVersion: "7.1.0" };
    const infoMessages: string[] = [];
    const recordingLogger = { ...logger, info: (message: string) => infoMessages.push(message) };

    const client = createClient("sdk-key", { logger: recordingLogger });
    await client.initialize();

    expect(infoMessages.filter((message) => message.includes("could not find"))).toHaveLength(0);

    client.dispose();
  });

  const waitForTelemetryReport = async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (requests.some((request) => request.url.includes("telemetry"))) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
});
