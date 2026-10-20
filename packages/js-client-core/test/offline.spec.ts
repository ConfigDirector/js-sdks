import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { DefaultConfigDirectorClient } from "../src";
import type { ConfigDirectorClient, ConfigDirectorClientOptions, ConfigEvaluation } from "../src";
import { ConfigDirectorInitializationError } from "../src/errors";
import { discardingTelemetryClient } from "../src/telemetry/discarding";
import { POLL_URL, SSE_URL, TELEMETRY_URL, createCapturingLogger, createStubbedLogger, sleep } from "./helpers";

const logger = createStubbedLogger();
const liveTelemetryClient = vi.fn(() => discardingTelemetryClient);

const createClient = (clientSdkKey: string | undefined, clientOptions?: ConfigDirectorClientOptions) =>
  new DefaultConfigDirectorClient(
    liveTelemetryClient,
    clientSdkKey,
    { sdkName: "test-sdk", sdkVersion: "1.2.0" },
    { logger, ...clientOptions },
  );

const evaluationsOf = (client: ConfigDirectorClient) => {
  const evaluations: ConfigEvaluation[] = [];
  client.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));
  return evaluations;
};

const eventsOf = (client: ConfigDirectorClient) => {
  const events: string[] = [];
  client.on("clientReady", () => events.push("clientReady"));
  client.on("configsUpdated", () => events.push("configsUpdated"));
  client.on("contextUpdated", ({ context }) => events.push(`contextUpdated:${context?.id ?? "none"}`));
  return events;
};

const seeded = {
  "new-checkout": true,
  "max-items": 20,
  ratio: 2.5,
  greeting: "hello",
  theme: { color: "blue", sizes: [1, 2] },
  tags: ["a", "b"],
};

describe("offline mode", () => {
  const clients: ConfigDirectorClient[] = [];
  const track = (client: ConfigDirectorClient) => {
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    await commands.mswSetup();
  });
  beforeEach(async () => {
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLL_URL }, { url: TELEMETRY_URL });
  });
  afterEach(() => {
    clients.splice(0).forEach((client) => client.dispose());
    liveTelemetryClient.mockClear();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await commands.mswTeardown();
  });

  test("serves inline values typed by the value to every context without a request", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: seeded } }));

    await client.initialize({ id: "user-a" });

    expect(client.getValue("new-checkout", false)).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
    expect(client.getValue("ratio", 0)).toBe(2.5);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(client.getValue("theme", {})).toEqual({ color: "blue", sizes: [1, 2] });
    expect(client.getValue("tags", [] as string[])).toEqual(["a", "b"]);

    await client.updateContext({ id: "user-b", traits: { plan: "pro" } });

    expect(client.getValue("new-checkout", false)).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
    await sleep(10);
    expect(await commands.mswWasRequestReceived()).toBe(false);
    expect(liveTelemetryClient).not.toHaveBeenCalled();
  });

  test("serves every value with the found-match reason", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: { greeting: "hello" } } }));
    const evaluations = evaluationsOf(client);
    await client.initialize({ id: "user-a" });

    client.getValue("greeting", "");
    await sleep(0);

    expect(evaluations).toEqual([
      {
        key: "greeting",
        value: "hello",
        valueId: undefined,
        isDefaultValue: false,
        reason: "found-match",
        context: { id: "user-a" },
      },
    ]);
  });

  test("with no source is ready at once and serves in-code defaults with config-state-missing", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline" } }));
    const evaluations = evaluationsOf(client);

    await client.initialize();

    expect(client.isReady).toBe(true);
    expect(client.getValue("new-checkout", false)).toBe(false);
    await sleep(0);
    expect(evaluations).toEqual([
      { key: "new-checkout", value: false, isDefaultValue: true, reason: "config-state-missing", context: undefined },
    ]);
    expect(await commands.mswWasRequestReceived()).toBe(false);
  });

  test("is ready with clientReady fired once before initialize resolves", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: seeded } }));
    let readyCount = 0;
    client.on("clientReady", () => readyCount++);

    const initialization = client.initialize();
    expect(client.isReady).toBe(false);
    expect(client.isInitializing).toBe(true);
    const outcome = await Promise.race([
      initialization.then(() => "initialized"),
      sleep(0).then(() => "timers ran first"),
    ]);

    expect(outcome).toBe("initialized");
    expect(client.isReady).toBe(true);
    expect(client.isInitializing).toBe(false);
    expect(readyCount).toBe(1);
    await sleep(10);
    expect(readyCount).toBe(1);
  });

  test("fires a watcher once with the offline value and never again", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: { "max-items": 20 } } }));
    const watched: number[] = [];
    client.watch("max-items", 0, (value) => watched.push(value));

    await client.initialize();
    await sleep(10);

    expect(watched).toEqual([20]);
  });

  test("serves the in-code default with type-mismatch when the value's type differs", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: { "new-checkout": true } } }));
    const evaluations = evaluationsOf(client);
    await client.initialize();

    expect(client.getValue("new-checkout", "fallback")).toBe("fallback");
    await sleep(0);

    expect(evaluations).toEqual([
      expect.objectContaining({ key: "new-checkout", value: "fallback", isDefaultValue: true, reason: "type-mismatch" }),
    ]);
  });

  test("ignores pollingInterval, timeout and url without a warning or an error", async () => {
    const capturingLogger = createCapturingLogger();
    const client = track(
      createClient(undefined, {
        logger: capturingLogger,
        connection: { mode: "offline", values: { greeting: "hello" }, pollingInterval: 1, timeout: 1, url: "not a url" },
      }),
    );

    await client.initialize();

    expect(client.isReady).toBe(true);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(capturingLogger.warn).not.toHaveBeenCalled();
    expect(capturingLogger.error).not.toHaveBeenCalled();
    expect(await commands.mswWasRequestReceived()).toBe(false);
  });

  test("updateContext stores the context and fires contextUpdated without delivering the values again", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: { "max-items": 20 } } }));
    const watched: number[] = [];
    client.watch("max-items", 0, (value) => watched.push(value));
    await client.initialize({ id: "user-a" });
    const events = eventsOf(client);

    await client.updateContext({ id: "user-b" });
    await sleep(10);

    expect(client.context).toEqual({ id: "user-b" });
    expect(client.isReady).toBe(true);
    expect(events).toEqual(["contextUpdated:user-b"]);
    expect(watched).toEqual([20]);
    expect(client.getValue("max-items", 0)).toBe(20);
  });

  test("pauseNetwork leaves the client ready", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: { "max-items": 20 } } }));
    await client.initialize();

    client.pauseNetwork();

    expect(client.isReady).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
  });

  test("resumeNetwork resolves without delivering the values or firing clientReady again", async () => {
    const client = track(createClient(undefined, { connection: { mode: "offline", values: { "max-items": 20 } } }));
    await client.initialize({ id: "user-a" });
    client.pauseNetwork();
    const events = eventsOf(client);

    await client.resumeNetwork();
    await sleep(10);

    expect(events).toEqual([]);
    expect(client.isReady).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
  });

  describe("SDK key", () => {
    test("accepts an absent SDK key in offline mode", async () => {
      const client = track(createClient(undefined, { connection: { mode: "offline", values: { greeting: "hello" } } }));

      await client.initialize();

      expect(client.getValue("greeting", "")).toBe("hello");
    });

    test("accepts an empty SDK key in offline mode", async () => {
      const client = track(createClient("", { connection: { mode: "offline", values: { greeting: "hello" } } }));

      await client.initialize();

      expect(client.getValue("greeting", "")).toBe("hello");
    });

    test("still rejects a missing SDK key in streaming mode", () => {
      expect(() => track(createClient(undefined, { connection: { mode: "streaming" } }))).toThrow(
        "No client SDK key was provided",
      );
    });

    test("still rejects a missing SDK key in polling mode", () => {
      expect(() => track(createClient(undefined, { connection: { mode: "polling" } }))).toThrow(
        "No client SDK key was provided",
      );
    });
  });

  describe("rejected sources", () => {
    const expectRejection = async (client: ConfigDirectorClient, messagePart: string) => {
      const initialization = client.initialize();

      await expect(initialization).rejects.toBeInstanceOf(ConfigDirectorInitializationError);
      await expect(initialization).rejects.toThrow(messagePart);
      expect(client.isReady).toBe(false);
      expect(client.isInitializing).toBe(false);
      expect(await commands.mswWasRequestReceived()).toBe(false);
      expect(liveTelemetryClient).not.toHaveBeenCalled();
    };

    test("rejects initialization when the values hold a null value", async () => {
      const client = track(
        createClient(undefined, { connection: { mode: "offline", values: { "new-checkout": null as any } } }),
      );

      await expectRejection(client, "Invalid value for 'new-checkout': null");
    });

    test("rejects initialization when values are given in streaming mode", async () => {
      const client = track(createClient("sdk-key", { connection: { mode: "streaming", values: seeded } }));

      await expectRejection(client, "applies only when the connection mode is 'offline'");
    });

    test("rejects initialization when values are given in polling mode", async () => {
      const client = track(createClient("sdk-key", { connection: { mode: "polling", values: seeded } }));

      await expectRejection(client, "applies only when the connection mode is 'offline'");
    });
  });
});
