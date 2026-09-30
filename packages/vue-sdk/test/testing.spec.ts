import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { commands } from "vitest/browser";
import { render, screen } from "@testing-library/vue";
import { defineComponent, nextTick } from "vue";
import { ConfigDirectorPlugin, useConfigValue, useClientStatus, useContext } from "../src";
import type { ConfigDirectorClient } from "../src";
import { createTestClient, ConfigDirectorValidationError } from "../src/testing";
import type { TestClient } from "../src/testing";
import { SSE_URL, createStubbedLogger } from "./helpers";

const POLL_URL = "https://client-sdk-api.configdirector.com/client/polling/v1";
const TELEMETRY_URL = "https://client-sdk-api.configdirector.com/client/telemetry/v1";

const logger = createStubbedLogger();

const Greeting = defineComponent({
  setup() {
    const { value } = useConfigValue("greeting", "default");
    const { readyStatus } = useClientStatus();
    return { value, readyStatus };
  },
  template: '<div><span data-testid="value">{{ value }}</span><span data-testid="status">{{ readyStatus }}</span></div>',
});

const renderWith = (client: ConfigDirectorClient) =>
  render(Greeting, { global: { plugins: [[ConfigDirectorPlugin, client]] } });

describe("@configdirector/vue-sdk/testing", () => {
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
  });
  afterAll(async () => await commands.mswTeardown());

  test("S16 composables reflect setValue and removeValue", async () => {
    await commands.mswUseHandlers({ url: SSE_URL }, { url: POLL_URL }, { url: TELEMETRY_URL });
    const testClient = create({ values: { greeting: "hello" } });

    renderWith(testClient.client);
    await screen.findByText("hello");
    expect(screen.getByTestId("status")).toHaveTextContent("ready");

    testClient.setValue("greeting", "changed");
    await nextTick();
    expect(screen.getByTestId("value")).toHaveTextContent("changed");

    testClient.removeValue("greeting");
    await nextTick();
    expect(screen.getByTestId("value")).toHaveTextContent("default");
    expect(await commands.mswWasRequestReceived()).toBe(false);
  });

  test("the plugin accepts a test client's client and initializes it once", async () => {
    const testClient = create({ values: { greeting: "hello" } });

    renderWith(testClient.client);
    await screen.findByText("hello");

    expect(testClient.contextUpdates).toEqual([{}]);
  });

  test("the plugin does not initialize a client that is already ready", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize({ id: "user-a" });

    renderWith(testClient.client);

    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("value")).toHaveTextContent("hello");
    expect(testClient.contextUpdates).toEqual([{ id: "user-a" }]);
  });

  test("a held initialize keeps the status loading until it completes", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.holdInitialization();

    renderWith(testClient.client);
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("value")).toHaveTextContent("default");

    testClient.completeInitialization();
    await screen.findByText("hello");
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  test("a failed initialize shows the default status", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    testClient.failInitialization();

    renderWith(testClient.client);

    await vi.waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("default"));
    expect(screen.getByTestId("value")).toHaveTextContent("default");
  });

  test("useContext updates the context through the test client", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    const ContextProbe = defineComponent({
      setup() {
        const { updateContext, context } = useContext();
        return { updateContext, context };
      },
      template: '<button data-testid="update" @click="updateContext({ id: \'user-b\' })">{{ context?.id ?? "none" }}</button>',
    });
    render(ContextProbe, { global: { plugins: [[ConfigDirectorPlugin, testClient.client]] } });
    await vi.waitFor(() => expect(testClient.client.isReady).toBe(true));

    screen.getByTestId("update").click();
    await vi.waitFor(() => expect(screen.getByTestId("update")).toHaveTextContent("user-b"));

    expect(testClient.contextUpdates).toEqual([{}, { id: "user-b" }]);
  });

  test("createTestClient rejects a null value", () => {
    expect(() => create({ values: { k: null as any } })).toThrow(ConfigDirectorValidationError);
  });
});
