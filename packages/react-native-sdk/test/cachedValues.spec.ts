import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ConfigEvaluation } from "@js-client-core/index";
import { createClient } from "../src/client";
import { buildResponse, createStubbedLogger, full, message } from "./helpers";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest"),
);

const CACHED_VALUES_STORAGE_KEY =
  "configdirector-sdk:cached-values:cc677751b8441e282621773a9be4622b11cd5bcffce54caabdd19f60e07d556c";

const stringConfig = (key: string, value: string) => ({
  [key]: { id: `id-${key}`, key, type: "string", value, valueId: `value-id-${key}` },
});

const logger = createStubbedLogger();

describe("createClient's cached values with AsyncStorage installed", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof globalThis, "fetch", any>>;
  const network = { reachable: true };

  beforeAll(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(async (url: any) => {
      if (url.toString().includes("telemetry")) {
        return Response.json({}, { status: 204 });
      }
      if (!network.reachable) {
        throw new TypeError("Network request failed");
      }
      return buildResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(message(full(stringConfig("my-config", "from-server"))));
          },
        }),
      );
    });
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    network.reachable = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  test("keeps the last values in AsyncStorage with only the SDK key's SHA-256 digest, under a key derived from that digest, and serves them with reason cached when the app starts without a network", async () => {
    const firstRun = createClient("sdk-key", { logger });
    await firstRun.initialize({ id: "user-1" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    firstRun.dispose();
    const storedEntry = (await AsyncStorage.getItem(CACHED_VALUES_STORAGE_KEY)) as string;
    expect(storedEntry).not.toContain("sdk-key");
    expect(JSON.parse(storedEntry)).toMatchObject({
      clientSdkKeyDigest: "cc677751b8441e282621773a9be4622b11cd5bcffce54caabdd19f60e07d556c",
      contextTag: { contextKind: "user", contextId: "user-1" },
      configs: stringConfig("my-config", "from-server"),
    });
    network.reachable = false;
    const relaunch = createClient("sdk-key", { logger, connection: { timeout: 100 } });
    const evaluations: ConfigEvaluation[] = [];
    relaunch.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));

    await relaunch.initialize({ id: "user-1" });

    expect(relaunch.isReady).toBe(false);
    expect(relaunch.getValue("my-config", "default")).toBe("from-server");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(evaluations).toContainEqual(
      expect.objectContaining({ key: "my-config", value: "from-server", isDefaultValue: false, reason: "cached" }),
    );
    relaunch.dispose();
  });

  test("removes an entry it cannot read from AsyncStorage and serves in-code defaults", async () => {
    await AsyncStorage.setItem(CACHED_VALUES_STORAGE_KEY, "{");
    network.reachable = false;
    const events: string[] = [];
    const client = createClient("sdk-key", { logger, connection: { timeout: 100 } });
    client.on("cachedValuesLoaded", () => events.push("cachedValuesLoaded"));

    await client.initialize({ id: "user-1" });

    expect(client.getValue("my-config", "default")).toBe("default");
    expect(events).toEqual([]);
    expect(await AsyncStorage.getItem(CACHED_VALUES_STORAGE_KEY)).toBeNull();
    client.dispose();
  });

  test("keeps nothing in AsyncStorage when caching is turned off", async () => {
    const client = createClient("sdk-key", { logger, caching: { enabled: false } });
    await client.initialize({ id: "user-1" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    client.dispose();

    expect(await AsyncStorage.getItem(CACHED_VALUES_STORAGE_KEY)).toBeNull();
  });
});
