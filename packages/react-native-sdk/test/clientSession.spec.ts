import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "../src/client";
import { buildResponse, createStubbedLogger, full, message, SSE_URL, UUID_V4_PATTERN } from "./helpers";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest"),
);

const INSTANCE_ID_STORAGE_KEY = "configdirector-sdk:instance-id";
const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1_000;

const logger = createStubbedLogger();

describe("createClient's instance id with AsyncStorage installed", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof globalThis, "fetch", any>>;
  let now: jest.SpiedFunction<typeof Date.now>;
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

  beforeEach(async () => {
    await AsyncStorage.clear();
    now = jest.spyOn(Date, "now");
  });

  afterEach(() => {
    now.mockRestore();
    requests.length = 0;
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  const connectPayloads = () => requests.filter((request) => request.url.startsWith(SSE_URL)).map((request) => request.body);

  const storedRecord = async () => JSON.parse((await AsyncStorage.getItem(INSTANCE_ID_STORAGE_KEY)) as string);

  const initializeAndDispose = async () => {
    const client = createClient("sdk-key", { logger });
    await client.initialize();
    client.dispose();
  };

  test("persists the instance id in AsyncStorage and reuses it for a client created a year later", async () => {
    now.mockReturnValue(1_700_000_000_000);
    await initializeAndDispose();

    now.mockReturnValue(1_700_000_000_000 + ONE_YEAR_MS);
    await initializeAndDispose();

    const [first, second] = connectPayloads();
    expect(first).toMatchObject({ instanceId: expect.stringMatching(UUID_V4_PATTERN) });
    expect(first).not.toHaveProperty("ephemeral");
    expect(second?.instanceId).toBe(first?.instanceId);
    expect(second).not.toHaveProperty("ephemeral");
    expect(await storedRecord()).toMatchObject({ id: first?.instanceId, createdAt: 1_700_000_000_000 });
  });

  test("connects with the instance id an earlier version of the SDK stored in AsyncStorage", async () => {
    const storedByEarlierVersion =
      '{"v":1,"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","createdAt":1760000000000,"checksum":"50773f6a1e3e9b5e"}';
    await AsyncStorage.setItem(INSTANCE_ID_STORAGE_KEY, storedByEarlierVersion);
    now.mockReturnValue(1_800_000_000_000);

    await initializeAndDispose();

    const [payload] = connectPayloads();
    expect(payload?.instanceId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(payload).not.toHaveProperty("ephemeral");
    expect(await AsyncStorage.getItem(INSTANCE_ID_STORAGE_KEY)).toBe(storedByEarlierVersion);
  });

  test("says nothing about AsyncStorage when it is installed", async () => {
    const warnings: string[] = [];
    const recordingLogger = { ...logger, warn: (message: string) => warnings.push(message) };

    const client = createClient("sdk-key", { logger: recordingLogger });
    await client.initialize();
    client.dispose();

    expect(warnings).toHaveLength(0);
  });
});
