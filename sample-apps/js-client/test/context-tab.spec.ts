import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createTestClient } from "@configdirector/client-sdk/testing";
import type { TestClient } from "@configdirector/client-sdk/testing";
import { initContextTab } from "../src/context-tab";
import { input, isShown, renderSamplePage } from "./sample-page";

describe("context tab", () => {
  let testClient: TestClient;

  beforeEach(async () => {
    renderSamplePage();
    testClient = createTestClient();
    await testClient.client.initialize();
    initContextTab(testClient.client);
  });

  afterEach(() => testClient.client.dispose());

  const save = () => document.getElementById("save-button")!.click();

  test("sends the entered user as the context", async () => {
    input("user-id-input").value = "user-123";
    input("user-name-input").value = "Ada";
    input("user-role-input").value = "admin";

    save();

    await vi.waitFor(() => expect(isShown("saved-message")).toBe(true));
    expect(testClient.contextUpdates).toEqual([
      {},
      { id: "user-123", name: "Ada", traits: { role: "admin" } },
    ]);
  });

  test("leaves the empty fields out of the context", async () => {
    input("user-name-input").value = "Ada";

    save();

    await vi.waitFor(() => expect(isShown("saved-message")).toBe(true));
    expect(testClient.contextUpdates).toEqual([{}, { name: "Ada" }]);
  });

  test("waits for the context update before confirming it", async () => {
    testClient.holdContextUpdate();
    input("user-id-input").value = "user-123";

    save();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(testClient.contextUpdates).toHaveLength(2);
    expect(isShown("saved-message")).toBe(false);

    testClient.completeContextUpdate();

    await vi.waitFor(() => expect(isShown("saved-message")).toBe(true));
  });

  test("clears the fields and sends an empty context", async () => {
    input("user-id-input").value = "user-123";
    input("user-name-input").value = "Ada";
    input("user-role-input").value = "admin";

    document.getElementById("clear-button")!.click();

    await vi.waitFor(() => expect(isShown("cleared-message")).toBe(true));
    expect(testClient.contextUpdates).toStrictEqual([{}, {}]);
    expect([
      input("user-id-input").value,
      input("user-name-input").value,
      input("user-role-input").value,
    ]).toEqual(["", "", ""]);
  });
});
