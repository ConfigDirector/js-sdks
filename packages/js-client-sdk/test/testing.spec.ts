import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { createTestClient, ConfigDirectorValidationError } from "../src/testing";
import type { TestClient } from "../src/testing";
import type { ConfigDirectorContext, ConfigDirectorLogger } from "../src";
import type { ConfigEvaluation } from "@js-client-core/types";
import { SSE_URL, POLL_URL, sleep, createStubbedLogger } from "./helpers";

const TELEMETRY_URL = "https://client-sdk-api.configdirector.com/client/telemetry/v1";

const logger: ConfigDirectorLogger = createStubbedLogger();

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

describe("@configdirector/client-sdk/testing", () => {
  const testClients: TestClient[] = [];
  const create = (...args: Parameters<typeof createTestClient>) => {
    const testClient = createTestClient({ logger, ...args[0] });
    testClients.push(testClient);
    return testClient;
  };

  beforeAll(async () => {
    await commands.mswSetup();
  });
  afterEach(() => {
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  afterAll(async () => await commands.mswTeardown());

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

  test("S2 reading a boolean as a string returns the in-code default with type-mismatch", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    const evaluations = evaluationsOf(testClient);
    await testClient.client.initialize();

    expect(testClient.client.getValue("new-checkout", "fallback")).toBe("fallback");
    await sleep(0);

    expect(evaluations[evaluations.length - 1]).toMatchObject({ key: "new-checkout", reason: "type-mismatch", isDefaultValue: true });
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
    expect(updates[updates.length - 1]).toEqual({ keys: ["max-items"], removedKeys: [] });
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
    expect(evaluations[evaluations.length - 1]).toMatchObject({ key: "new-checkout", reason: "config-state-missing" });
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
    expect(updates[updates.length - 1]).toEqual({ keys: ["other"], removedKeys: ["new-checkout"] });
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
    const readyEvents: string[] = [];
    testClient.client.on("clientReady", ({ action }) => readyEvents.push(action));
    testClient.holdInitialization();

    let settled = false;
    const initialization = testClient.client.initialize().then(() => (settled = true));
    await sleep(20);
    expect(settled).toBe(false);
    expect(testClient.client.isReady).toBe(false);

    testClient.completeInitialization();
    await initialization;

    expect(testClient.client.isReady).toBe(true);
    expect(readyEvents).toEqual(["initialization"]);
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
    const readyEvents: string[] = [];
    testClient.client.on("clientReady", ({ action }) => readyEvents.push(action));
    testClient.failInitialization();

    const startedAt = Date.now();
    await testClient.client.initialize();

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(false);
    expect(readyEvents).toEqual([]);
  });

  test("S13 contextUpdates records initialize and updateContext contexts and nothing else", async () => {
    const testClient = create({ values: {} });
    const a: ConfigDirectorContext = { id: "user-a" };
    const b: ConfigDirectorContext = { id: "user-b", traits: { plan: "pro" } };

    await testClient.client.initialize(a);
    await testClient.client.updateContext(b);
    testClient.client.pauseNetwork();
    await testClient.client.resumeNetwork();

    expect(testClient.contextUpdates).toEqual([a, b]);
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
    const initialization = testClient.client.initialize();
    await vi.runAllTimersAsync();
    await initialization;
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
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLL_URL }, { url: TELEMETRY_URL });
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
    expect(await commands.mswWasRequestReceived()).toBe(false);
  });

  test("S24 removeValue before initialize makes the key read as missing", async () => {
    const testClient = create({ values: { "new-checkout": true } });
    const evaluations = evaluationsOf(testClient);
    testClient.removeValue("new-checkout");

    await testClient.client.initialize();

    expect(testClient.client.getValue("new-checkout", false)).toBe(false);
    await sleep(0);
    expect(evaluations[evaluations.length - 1]).toMatchObject({ reason: "config-state-missing" });
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

  test("S26 a held updateContext stays pending until completeContextUpdate", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize({ id: "user-a" });
    testClient.holdContextUpdate();

    const update = testClient.client.updateContext({ id: "user-b" });
    await sleep(20);
    expect(testClient.client.isReady).toBe(false);

    testClient.completeContextUpdate();
    await update;

    expect(testClient.client.isReady).toBe(true);
    expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]);
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

  test("S39 initialize emits contextUpdated, then configsUpdated, then clientReady", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const order: string[] = [];
    testClient.client.on("contextUpdated", () => order.push("contextUpdated"));
    testClient.client.on("configsUpdated", () => order.push("configsUpdated"));
    testClient.client.on("clientReady", () => order.push("clientReady"));

    await testClient.client.initialize({ id: "user-a" });

    expect(order).toEqual(["contextUpdated", "configsUpdated", "clientReady"]);
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
    const readyEvents: string[] = [];
    testClient.client.on("configsUpdated", ({ keys }) => updates.push(keys));
    testClient.client.on("clientReady", ({ action }) => readyEvents.push(action));
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
    expect(readyEvents).toEqual(["initialization"]);
    expect(testClient.client.getValue("a", 0)).toBe(2);
    expect(testClient.client.getValue("b", 0)).toBe(2);
  });

  test("S42 an armed initialization hold never affects updateContext", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    await testClient.client.initialize({ id: "user-a" });
    testClient.holdInitialization();

    const startedAt = Date.now();
    await testClient.client.updateContext({ id: "user-b" });

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(true);
    expect(testClient.contextUpdates).toEqual([{ id: "user-a" }, { id: "user-b" }]);
  });

  test("S43 failContextUpdate fails the next updateContext promptly", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    await testClient.client.initialize({ id: "user-a" });
    testClient.failContextUpdate();

    const startedAt = Date.now();
    await testClient.client.updateContext({ id: "user-b" });

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(false);
  });

  test("S44 a resume is never held and leaves the context update hold armed", async () => {
    const testClient = create({ values: { greeting: "hello" }, timeout: 5_000 });
    await testClient.client.initialize();
    testClient.holdContextUpdate();
    testClient.client.pauseNetwork();

    const startedAt = Date.now();
    await testClient.client.resumeNetwork();
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(testClient.client.isReady).toBe(true);

    const update = testClient.client.updateContext({ id: "user-b" });
    await sleep(20);
    expect(testClient.client.isReady).toBe(false);
    testClient.completeContextUpdate();
    await update;
    expect(testClient.client.isReady).toBe(true);
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
    expect(evaluations[evaluations.length - 1]).toMatchObject({ reason: "value-missing" });
  });
});
