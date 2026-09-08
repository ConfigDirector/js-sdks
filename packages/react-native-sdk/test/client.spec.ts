import { afterAll, afterEach, beforeAll, describe, expect, test, jest } from "@jest/globals";
import { createClient } from "../src/client";
import { buildResponse, createStubbedLogger, full, message, SSE_URL } from "./helpers";

const logger = createStubbedLogger();

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
  });

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
});
