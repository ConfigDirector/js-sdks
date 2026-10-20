import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, passthrough } from "msw";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createClient, ConfigDirectorInitializationError } from "../src";
import type { ConfigDirectorClient } from "../src";
import type { ConfigEvaluation } from "../src/types";
import { createStubbedLogger, sleep } from "./helpers";

const logger = createStubbedLogger();

const evaluationsOf = (client: ConfigDirectorClient) => {
  const evaluations: ConfigEvaluation[] = [];
  client.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));
  return evaluations;
};

const writeValuesFile = async (contents: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "configdirector-offline-"));
  const file = join(directory, "values.json");
  await writeFile(file, contents);
  return relative(process.cwd(), file);
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
  const requests: string[] = [];
  const server = setupServer(
    http.all("*", ({ request }) => {
      requests.push(request.url);
      return passthrough();
    }),
  );
  const clients: ConfigDirectorClient[] = [];
  const track = (client: ConfigDirectorClient) => {
    clients.push(client);
    return client;
  };

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    clients.splice(0).forEach((client) => client.dispose());
    requests.splice(0);
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  test("serves inline values typed by the value to every context without an SDK key or a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const client = track(createClient({ logger, connection: { mode: "offline", values: seeded } }));

    await client.initialize();

    expect(client.getValue("new-checkout", false, { id: "user-a" })).toBe(true);
    expect(client.getValue("new-checkout", false, { id: "user-b", traits: { plan: "pro" } })).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
    expect(client.getValue("ratio", 0)).toBe(2.5);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(client.getValue("theme", {})).toEqual({ color: "blue", sizes: [1, 2] });
    expect(client.getValue("tags", [] as string[])).toEqual(["a", "b"]);
    client.dispose();
    await sleep(10);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  test("serves the values of a JSON file resolved against the working directory", async () => {
    const file = await writeValuesFile(JSON.stringify(seeded));
    const client = track(createClient({ logger, connection: { mode: "offline", file } }));

    await client.initialize();

    expect(client.getValue("new-checkout", false, { id: "user-a" })).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
    expect(client.getValue("ratio", 0)).toBe(2.5);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(client.getValue("theme", {})).toEqual({ color: "blue", sizes: [1, 2] });
    expect(client.getValue("tags", [] as string[])).toEqual(["a", "b"]);
    expect(requests).toEqual([]);
  });

  test("serves every value with the found-match reason", async () => {
    const client = track(createClient({ logger, connection: { mode: "offline", values: { greeting: "hello" } } }));
    const evaluations = evaluationsOf(client);
    await client.initialize();

    client.getValue("greeting", "", { id: "user-a" });
    await sleep(0);

    expect(evaluations).toEqual([
      { key: "greeting", value: "hello", valueId: undefined, isDefaultValue: false, reason: "found-match", context: { id: "user-a" } },
    ]);
  });

  test("with no source is ready at once and serves in-code defaults with config-state-missing", async () => {
    const client = track(createClient({ logger, connection: { mode: "offline" } }));
    const evaluations = evaluationsOf(client);

    await client.initialize();

    expect(client.isReady).toBe(true);
    expect(client.getValue("new-checkout", false)).toBe(false);
    await sleep(0);
    expect(evaluations).toEqual([
      { key: "new-checkout", value: false, isDefaultValue: true, reason: "config-state-missing", context: undefined },
    ]);
    expect(requests).toEqual([]);
  });

  test("is ready with clientReady fired once before initialize resolves", async () => {
    const client = track(createClient({ logger, connection: { mode: "offline", values: seeded } }));
    let readyCount = 0;
    client.on("clientReady", () => readyCount++);

    const initialization = client.initialize();
    expect(client.isReady).toBe(false);
    await initialization;

    expect(client.isReady).toBe(true);
    expect(readyCount).toBe(1);
    await sleep(10);
    expect(readyCount).toBe(1);
  });

  test("fires a watcher once with the offline value and never again", async () => {
    const client = track(createClient({ logger, connection: { mode: "offline", values: { "max-items": 20 } } }));
    const watched: number[] = [];
    client.watch("max-items", 0, (value) => watched.push(value));

    await client.initialize();
    await sleep(10);

    expect(watched).toEqual([20]);
  });

  test("returns the offline values from getAllConfigs", async () => {
    const client = track(createClient({ logger, connection: { mode: "offline", values: { "new-checkout": true, "max-items": 20 } } }));
    await client.initialize();

    expect(client.getAllConfigs({ context: { id: "user-a" } })).toMatchObject({
      "new-checkout": { key: "new-checkout", type: "boolean", value: "true" },
      "max-items": { key: "max-items", type: "integer", value: "20" },
    });
    expect(Object.keys(client.getAllConfigs())).toEqual(["new-checkout", "max-items"]);
  });

  test("serves the in-code default with type-mismatch when the value's type differs", async () => {
    const client = track(createClient({ logger, connection: { mode: "offline", values: { "new-checkout": true } } }));
    const evaluations = evaluationsOf(client);
    await client.initialize();

    expect(client.getValue("new-checkout", "fallback")).toBe("fallback");
    await sleep(0);

    expect(evaluations).toEqual([
      expect.objectContaining({ key: "new-checkout", value: "fallback", isDefaultValue: true, reason: "type-mismatch" }),
    ]);
  });

  test("ignores pollingInterval, timeout and url without a warning or an error", async () => {
    const warningLogger = { ...createStubbedLogger(), warn: vi.fn(), error: vi.fn() };
    const client = track(createClient({
      logger: warningLogger,
      connection: { mode: "offline", values: { greeting: "hello" }, pollingInterval: 1, timeout: 1, url: "not a url" },
    }));

    await client.initialize();

    expect(client.isReady).toBe(true);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(warningLogger.warn).not.toHaveBeenCalled();
    expect(warningLogger.error).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  describe("SDK key", () => {
    test("accepts an empty SDK key in offline mode", async () => {
      const client = track(createClient("", { logger, connection: { mode: "offline", values: { greeting: "hello" } } }));

      await client.initialize();

      expect(client.getValue("greeting", "")).toBe("hello");
    });

    test("still rejects a missing SDK key in streaming mode", () => {
      expect(() => track(createClient("", { logger, connection: { mode: "streaming" } }))).toThrow(
        "No server SDK key was provided",
      );
    });

    test("still rejects a missing SDK key in polling mode", () => {
      expect(() => track(createClient("", { logger, connection: { mode: "polling" } }))).toThrow(
        "No server SDK key was provided",
      );
    });
  });

  describe("rejected sources", () => {
    const expectRejection = async (client: ConfigDirectorClient, messagePart: string) => {
      const initialization = client.initialize();

      await expect(initialization).rejects.toBeInstanceOf(ConfigDirectorInitializationError);
      await expect(initialization).rejects.toThrow(messagePart);
      expect(client.isReady).toBe(false);
      expect(requests).toEqual([]);
    };

    test("rejects initialization when the file is missing", async () => {
      const client = track(createClient({ logger, connection: { mode: "offline", file: "./flags/does-not-exist.json" } }));

      await expectRejection(client, "'./flags/does-not-exist.json' could not be read");
    });

    test("rejects initialization when the file cannot be read", async () => {
      const directory = relative(process.cwd(), await mkdtemp(join(tmpdir(), "configdirector-offline-")));
      const client = track(createClient({ logger, connection: { mode: "offline", file: directory } }));

      await expectRejection(client, "could not be read");
    });

    test("rejects initialization when the file is not valid JSON", async () => {
      const file = await writeValuesFile("{ not json");
      const client = track(createClient({ logger, connection: { mode: "offline", file } }));

      await expectRejection(client, "is not valid JSON");
    });

    test("rejects initialization when the file does not hold a JSON object", async () => {
      const file = await writeValuesFile(JSON.stringify([true, 20]));
      const client = track(createClient({ logger, connection: { mode: "offline", file } }));

      await expectRejection(client, "must hold a JSON object");
    });

    test("rejects initialization when the file holds a null value", async () => {
      const file = await writeValuesFile(JSON.stringify({ "new-checkout": null }));
      const client = track(createClient({ logger, connection: { mode: "offline", file } }));

      await expectRejection(client, "Invalid value for 'new-checkout': null");
    });

    test("rejects initialization when the inline values hold a null value", async () => {
      const client = track(createClient({ logger, connection: { mode: "offline", values: { "new-checkout": null as any } } }));

      await expectRejection(client, "Invalid value for 'new-checkout': null");
    });

    test("rejects initialization when file and values are both given", async () => {
      const file = await writeValuesFile(JSON.stringify(seeded));
      const client = track(createClient({ logger, connection: { mode: "offline", file, values: seeded } }));

      await expectRejection(client, "either 'file' or 'values', not both");
    });

    test("rejects initialization when a file is given in streaming mode", async () => {
      const file = await writeValuesFile(JSON.stringify(seeded));
      const client = track(createClient("sdk-key", { logger, connection: { mode: "streaming", file } }));

      await expectRejection(client, "apply only when the connection mode is 'offline'");
    });

    test("rejects initialization when a file is given in polling mode", async () => {
      const file = await writeValuesFile(JSON.stringify(seeded));
      const client = track(createClient("sdk-key", { logger, connection: { mode: "polling", file } }));

      await expectRejection(client, "apply only when the connection mode is 'offline'");
    });

    test("rejects initialization when values are given in streaming mode", async () => {
      const client = track(createClient("sdk-key", { logger, connection: { mode: "streaming", values: seeded } }));

      await expectRejection(client, "apply only when the connection mode is 'offline'");
    });

    test("rejects initialization when values are given in polling mode", async () => {
      const client = track(createClient("sdk-key", { logger, connection: { mode: "polling", values: seeded } }));

      await expectRejection(client, "apply only when the connection mode is 'offline'");
    });
  });
});
