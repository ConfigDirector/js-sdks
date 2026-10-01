import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createTestClient, installServerTestClient } from "@configdirector/nextjs-sdk/server/testing";
import type { TestClient } from "@configdirector/nextjs-sdk/server/testing";
import { GET } from "../app/api/config/route";

describe("GET /api/config", () => {
  let testClient: TestClient;
  let uninstallServerTestClient: () => void;

  beforeEach(async () => {
    testClient = createTestClient({ values: { "server-api-value": "from the server" } });
    uninstallServerTestClient = installServerTestClient(testClient);
    await testClient.client.initialize();
  });

  afterEach(async () => {
    uninstallServerTestClient();
    await testClient.client.dispose();
  });

  test("serves the config value from the server client", async () => {
    const response = await GET();

    expect(await response.json()).toStrictEqual({ "server-api-value": "from the server" });
  });

  test("serves a changed value on the next request", async () => {
    testClient.setValue("server-api-value", "changed");

    const response = await GET();

    expect(await response.json()).toStrictEqual({ "server-api-value": "changed" });
  });

  test("serves the in-code default value when the config is missing", async () => {
    testClient.removeValue("server-api-value");

    const response = await GET();

    expect(await response.json()).toStrictEqual({ "server-api-value": "DEFAULT VALUE" });
  });
});
