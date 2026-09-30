import { afterEach, describe, expect, test } from "vitest";
import { ConfigDirectorProvider, generateSsrConfigSet, getConfigClient } from "../src/server";
import { createTestClient, installServerTestClient, ConfigDirectorValidationError } from "../src/server/testing";
import type { TestClient } from "../src/server/testing";

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

describe("@configdirector/nextjs-sdk/server/testing", () => {
  const testClients: TestClient[] = [];
  const uninstallers: (() => void)[] = [];
  const create = (...args: Parameters<typeof createTestClient>) => {
    const testClient = createTestClient({ logger, ...args[0] });
    testClients.push(testClient);
    return testClient;
  };
  const install = (testClient: TestClient) => {
    const uninstall = installServerTestClient(testClient);
    uninstallers.push(uninstall);
    return uninstall;
  };

  afterEach(() => {
    uninstallers.splice(0).reverse().forEach((uninstall) => uninstall());
    testClients.splice(0).forEach((testClient) => testClient.client.dispose());
  });

  test("S21 an installed server test client backs getConfigClient, generateSsrConfigSet, and the server provider", async () => {
    const testClient = create({ values: { greeting: "hello", "max-items": 20 } });
    install(testClient);
    await testClient.client.initialize();

    expect(getConfigClient()).toBe(testClient.client);
    expect(getConfigClient().getValue("greeting", "default", { id: "user-a" })).toBe("hello");
    expect(generateSsrConfigSet()).toMatchObject({
      greeting: { key: "greeting", type: "string", value: "hello" },
      "max-items": { key: "max-items", type: "integer", value: "20" },
    });

    const element = await ConfigDirectorProvider({ sdkKey: "client-key", children: null });
    expect(element.props.initialConfigs).toMatchObject({
      greeting: { key: "greeting", value: "hello" },
      "max-items": { key: "max-items", value: "20" },
    });
  });

  test("S21 uninstalling restores the previous global client", async () => {
    const previous = create({ values: { greeting: "previous" } });
    const uninstallPrevious = install(previous);
    const next = create({ values: { greeting: "next" } });
    const uninstallNext = install(next);
    expect(getConfigClient()).toBe(next.client);

    uninstallNext();
    expect(getConfigClient()).toBe(previous.client);

    uninstallPrevious();
    expect(() => getConfigClient()).toThrow("not initialized");
  });

  test("the server test client serves the same value to every context", async () => {
    const testClient = create({ values: { greeting: "hello" } });
    await testClient.client.initialize();

    expect(testClient.client.getValue("greeting", "default", { id: "user-a" })).toBe("hello");
    expect(testClient.client.getValue("greeting", "default", { id: "user-b", traits: { plan: "pro" } })).toBe("hello");
  });

  test("createTestClient rejects a null value", () => {
    expect(() => create({ values: { k: null as any } })).toThrow(ConfigDirectorValidationError);
  });
});
