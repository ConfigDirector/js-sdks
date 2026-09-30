import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { createTestClient, ConfigDirectorValidationError } from "../src/testing";
import type { TestClient } from "../src/testing";
import type { ConfigDirectorLogger, ConfigEvaluation } from "../src/types";
import { createStubbedLogger, sleep } from "./helpers";

const logger: ConfigDirectorLogger = createStubbedLogger();
const server = setupServer();

const seeded = {
  "new-checkout": true,
  "max-items": 20,
  ratio: 2.5,
  greeting: "hello",
  theme: { color: "blue", sizes: [1, 2] },
  tags: ["a", "b"],
};

const evaluationsOf = (testClient: TestClient) => {
  const evaluations: ConfigEvaluation[] = [];
  testClient.client.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));
  return evaluations;
};

const last = <T>(items: T[]): T | undefined => items[items.length - 1];

describe("@configdirector/server-sdk/testing", () => {
  const testClients: TestClient[] = [];
  const create = (...args: Parameters<typeof createTestClient>) => {
    const testClient = createTestClient({ logger, ...args[0] });
    testClients.push(testClient);
    return testClient;
  };

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  test("S1 reads every seeded value type after initialize", async () => {
    const { client } = create({ values: seeded });

    await client.initialize();

    expect(client.isReady).toBe(true);
    expect(client.getValue("new-checkout", false)).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
    expect(client.getValue("ratio", 0)).toBe(2.5);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(client.getValue("theme", {})).toEqual({ color: "blue", sizes: [1, 2] });
    expect(client.getValue("tags", [] as string[])).toEqual(["a", "b"]);
  });

  test("serves the same value to every context and lists every config in getAllConfigs", async () => {
    const { client } = create({ values: { "new-checkout": true, "max-items": 20 } });
    await client.initialize();

    expect(client.getValue("new-checkout", false, { id: "user-a" })).toBe(true);
    expect(client.getValue("new-checkout", false, { id: "user-b", traits: { plan: "pro" } })).toBe(true);
    expect(client.getAllConfigs()).toMatchObject({
      "new-checkout": { key: "new-checkout", type: "boolean", value: "true" },
      "max-items": { key: "max-items", type: "integer", value: "20" },
    });
  });

  test("S2 reading a boolean as a string returns the in-code default with type-mismatch", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    const evaluations = evaluationsOf(testClient);
    await testClient.client.initialize();

    expect(testClient.client.getValue("new-checkout", "fallback")).toBe("fallback");
    await sleep(0);

    expect(last(evaluations)).toMatchObject({ key: "new-checkout", reason: "type-mismatch", isDefaultValue: true });
  });

  test("S3 setValue on a connected client changes the next read", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    await testClient.client.initialize();

    testClient.setValue("new-checkout", false);

    expect(testClient.client.getValue("new-checkout", true)).toBe(false);
  });

  test("S4 setValue fires the key's watcher and lists the key in configsUpdated", async () => {
    const testClient = create({ values: { "max-items": 20 } });
    const watched: number[] = [];
    const updates: { keys: string[]; removedKeys: string[] }[] = [];
    testClient.client.watch("max-items", 0, (value) => watched.push(value));
    testClient.client.on("configsUpdated", (update) => updates.push(update));
    await testClient.client.initialize();

    testClient.setValue("max-items", 25);

    expect(watched).toEqual([20, 25]);
    expect(last(updates)).toEqual({ keys: ["max-items"], removedKeys: [] });
  });

  test("S5 setValue of another key does not fire an unrelated watcher", async () => {
    const testClient = create({ values: { a: 1, b: 2 } });
    const watched: number[] = [];
    testClient.client.watch("a", 0, (value) => watched.push(value));
    await testClient.client.initialize();
    watched.splice(0);

    testClient.setValue("b", 3);

    expect(watched).toEqual([]);
  });

  test("S6 removeValue makes reads return the in-code default with config-state-missing", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    const evaluations = evaluationsOf(testClient);
    await testClient.client.initialize();

    testClient.removeValue("new-checkout");

    expect(testClient.client.getValue("new-checkout", false)).toBe(false);
    await sleep(0);
    expect(last(evaluations)).toMatchObject({ key: "new-checkout", reason: "config-state-missing" });
  });

  test("S7 removeValue fires the watcher with the default and reports the key as removed", async () => {
    const testClient = create({ values: { "new-checkout": true, other: 1 } });
    const watched: boolean[] = [];
    const updates: { keys: string[]; removedKeys: string[] }[] = [];
    testClient.client.watch("new-checkout", false, (value) => watched.push(value));
    testClient.client.on("configsUpdated", (update) => updates.push(update));
    await testClient.client.initialize();

    testClient.removeValue("new-checkout");

    expect(watched).toEqual([true, false]);
    expect(last(updates)).toEqual({ keys: ["other"], removedKeys: ["new-checkout"] });
  });

  test("S8 setValue before initialize is delivered by the first connection", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.setValue("greeting", "hi");
    testClient.setValue("added", 1);

    await testClient.client.initialize();

    expect(testClient.client.getValue("greeting", "")).toBe("hi");
    expect(testClient.client.getValue("added", 0)).toBe(1);
  });

  test("S9 a held initialize stays pending until completeInitialization", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    let readyCount = 0;
    testClient.client.on("clientReady", () => readyCount++);
    testClient.holdInitialization();

    let settled = false;
    const initialization = testClient.client.initialize().then(() => (settled = true));
    await sleep(20);
    expect(settled).toBe(false);
    expect(testClient.client.isReady).toBe(false);

    testClient.completeInitialization();
    await initialization;

    expect(testClient.client.isReady).toBe(true);
    expect(readyCount).toBe(1);
  });

  test("S10 a value set while held is delivered by completeInitialization", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.holdInitialization();
    const initialization = testClient.client.initialize();

    testClient.setValue("greeting", "held");
    expect(testClient.client.getValue("greeting", "")).toBe("");
    testClient.completeInitialization();
    await initialization;

    expect(testClient.client.getValue("greeting", "")).toBe("held");
  });

  test("S11 a held initialize that times out completes not ready and the next initialize succeeds", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 50 });
    testClient.holdInitialization();

    const startedAt = Date.now();
    await testClient.client.initialize();
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(false);

    testClient.completeInitialization();
    await sleep(10);
    expect(testClient.client.isReady).toBe(false);

    await testClient.client.initialize();
    expect(testClient.client.isReady).toBe(true);
    expect(testClient.client.getValue("greeting", "")).toBe("hello");
  });

  test("S12 a failed initialize completes promptly, not ready, without clientReady", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    let readyCount = 0;
    testClient.client.on("clientReady", () => readyCount++);
    testClient.failInitialization();

    const startedAt = Date.now();
    await testClient.client.initialize();

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(false);
    expect(readyCount).toBe(0);
  });

  test("S14 operations after dispose are silent no-ops", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const watched: string[] = [];
    testClient.client.watch("greeting", "", (value) => watched.push(value));
    await testClient.client.initialize();
    watched.splice(0);
    testClient.client.dispose();

    expect(() => {
      testClient.setValue("greeting", "bye");
      testClient.removeValue("greeting");
      testClient.replaceValues({ greeting: "again" });
    }).not.toThrow();

    expect(watched).toEqual([]);
  });

  test("S15 two test clients never share values", async () => {
    const first = create({ values: { greeting: "one" } });
    const second = create({ values: { greeting: "two" } });
    await first.client.initialize();
    await second.client.initialize();

    first.setValue("greeting", "changed");

    expect(first.client.getValue("greeting", "")).toBe("changed");
    expect(second.client.getValue("greeting", "")).toBe("two");
  });

  test("S17 nothing from the SDK is left running after dispose", async () => {
    vi.useFakeTimers();
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize();
    testClient.setValue("greeting", "bye");

    testClient.client.dispose();

    expect(vi.getTimerCount()).toBe(0);
  });

  test("S22 a failed initialize emits connectionError", async () => {
    const testClient = create({ values: {} });
    const errors: Error[] = [];
    testClient.client.on("connectionError", ({ error }) => errors.push(error));
    testClient.failInitialization();

    await testClient.client.initialize();

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("unrecoverable");
  });

  test("S23 the test client makes no outbound request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const testClient = create({ values: seeded });

    await testClient.client.initialize();
    testClient.client.getValue("new-checkout", false);
    testClient.client.getValue("max-items", 0);
    testClient.client.getValue("greeting", "");
    testClient.client.getValue("theme", {});
    testClient.setValue("greeting", "bye");
    testClient.client.dispose();
    await sleep(20);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("S24 removeValue before initialize makes the key read as missing", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    const evaluations = evaluationsOf(testClient);
    testClient.removeValue("new-checkout");

    await testClient.client.initialize();

    expect(testClient.client.getValue("new-checkout", false)).toBe(false);
    await sleep(0);
    expect(last(evaluations)).toMatchObject({ reason: "config-state-missing" });
  });

  test("S25 after a failed initialize the next initialize delivers the stored values", async () => {
    const testClient = create({ values: {} });
    testClient.failInitialization();
    await testClient.client.initialize();
    expect(testClient.client.isReady).toBe(false);

    testClient.setValue("greeting", "later");
    await testClient.client.initialize();

    expect(testClient.client.isReady).toBe(true);
    expect(testClient.client.getValue("greeting", "")).toBe("later");
  });

  test("S32 replaceValues serves exactly the new values and fires dropped keys' watchers", async () => {
    const testClient = create({ values: { a: 1, b: 2 } });
    const watchedB: number[] = [];
    testClient.client.watch("b", 0, (value) => watchedB.push(value));
    await testClient.client.initialize();

    testClient.replaceValues({ a: 10, c: 3 });

    expect(testClient.client.getValue("a", 0)).toBe(10);
    expect(testClient.client.getValue("c", 0)).toBe(3);
    expect(testClient.client.getValue("b", 0)).toBe(0);
    expect(watchedB).toEqual([2, 0]);
  });

  test("S33 disposing during a held initialize ends it promptly and leaves nothing behind", async () => {
    vi.useFakeTimers();
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    testClient.holdInitialization();
    let settled = false;
    const initialization = testClient.client.initialize().then(() => (settled = true));

    testClient.client.dispose();
    await vi.advanceTimersByTimeAsync(10);

    expect(settled).toBe(true);
    expect(testClient.client.isReady).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    await initialization;
  });

  test("S38 completeInitialization before initialize disarms the hold", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    testClient.holdInitialization();
    testClient.completeInitialization();

    const startedAt = Date.now();
    await testClient.client.initialize();

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(true);
  });

  test("S40 replaceValues disarms an armed hold", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    testClient.holdInitialization();
    testClient.replaceValues({ greeting: "replaced" });

    const startedAt = Date.now();
    await testClient.client.initialize();

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(true);
    expect(testClient.client.getValue("greeting", "")).toBe("replaced");
  });

  test("S41 an operation called from a watcher runs after the outer delivery", async () => {
    const testClient = create({ values: { a: 1, b: 1 } });
    const observedBInsideWatcher: number[] = [];
    const updates: string[][] = [];
    let readyCount = 0;
    testClient.client.on("configsUpdated", ({ keys }) => updates.push(keys));
    testClient.client.on("clientReady", () => readyCount++);
    testClient.client.watch<number>("a", 0, (value) => {
      if (value === 2) {
        testClient.setValue("b", 2);
        observedBInsideWatcher.push(testClient.client.getValue("b", 0));
      }
    });
    await testClient.client.initialize();

    testClient.setValue("a", 2);

    expect(observedBInsideWatcher).toEqual([1]);
    expect(updates).toEqual([["a", "b"], ["a"], ["b"]]);
    expect(readyCount).toBe(1);
    expect(testClient.client.getValue("a", 0)).toBe(2);
    expect(testClient.client.getValue("b", 0)).toBe(2);
  });

  test("S39 the first update is delivered inside connect, before initialize yields", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const order: string[] = [];
    testClient.client.on("configsUpdated", () => order.push("configsUpdated"));
    testClient.client.on("clientReady", () => order.push("clientReady"));

    const initialization = testClient.client.initialize();
    expect(testClient.client.getValue("greeting", "")).toBe("hello");
    expect(order).toEqual(["configsUpdated"]);
    await initialization;

    expect(order).toEqual(["configsUpdated", "clientReady"]);
  });

  describe("rejected values", () => {
    test("createTestClient rejects a null value", () => {
      expect(() => create({ values: { k: null as any } })).toThrow(ConfigDirectorValidationError);
    });

    test("setValue rejects a non-finite number", () => {
      const testClient = create({ values: {} });
      expect(() => testClient.setValue("k", NaN)).toThrow(ConfigDirectorValidationError);
    });

    test("setValue rejects an empty key", () => {
      const testClient = create({ values: {} });
      expect(() => testClient.setValue("", true)).toThrow(ConfigDirectorValidationError);
    });

    test("replaceValues rejects an unsupported value without changing the stored values", async () => {
      const testClient = create({ values: { greeting: "hello" } });
      await testClient.client.initialize();

      expect(() => testClient.replaceValues({ greeting: "bye", bad: (() => 1) as any })).toThrow(
        ConfigDirectorValidationError,
      );

      expect(testClient.client.getValue("greeting", "")).toBe("hello");
    });
  });

  test("setValue with an empty string serves the in-code default with value-missing", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const evaluations = evaluationsOf(testClient);
    await testClient.client.initialize();

    testClient.setValue("greeting", "");

    expect(testClient.client.getValue("greeting", "fallback")).toBe("fallback");
    await sleep(0);
    expect(last(evaluations)).toMatchObject({ reason: "value-missing" });
  });
});
