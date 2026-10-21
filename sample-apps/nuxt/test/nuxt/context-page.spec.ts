import { beforeEach, describe, expect, test, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { createTestClient, installTestClient } from "@configdirector/nuxt-sdk/testing";
import ContextPage from "~/pages/context.vue";

// @nuxt/test-utils creates the Nuxt app once per test file, in a beforeAll hook, so the test client
// is installed at module level, before that, and the context is reset between tests.
const testClient = createTestClient();
installTestClient(testClient);

type Page = Awaited<ReturnType<typeof mountSuspended>>;

describe("context page", () => {
  let page: Page;
  let updatesBefore: number;

  beforeEach(async () => {
    await useConfigDirectorContext().updateContext({});
    updatesBefore = testClient.contextUpdates.length;
    page = await mountSuspended(ContextPage);
  });

  const contextUpdatesFromPage = () => testClient.contextUpdates.slice(updatesBefore);
  const savedMessage = () => page.find(".msg-green");
  const clearedMessage = () => page.find(".msg-gray");

  test("sends the entered user as the context", async () => {
    await page.find("#user-id").setValue("user-123");
    await page.find("#user-name").setValue("Ada");
    await page.find("#user-role").setValue("admin");

    await page.find("form").trigger("submit");

    await vi.waitFor(() => expect(savedMessage().classes()).not.toContain("hidden"));
    expect(contextUpdatesFromPage()).toEqual([{ id: "user-123", name: "Ada", traits: { role: "admin" } }]);
  });

  test("leaves the empty fields out of the context", async () => {
    await page.find("#user-name").setValue("Ada");

    await page.find("form").trigger("submit");

    await vi.waitFor(() => expect(savedMessage().classes()).not.toContain("hidden"));
    expect(contextUpdatesFromPage()).toEqual([{ name: "Ada" }]);
  });

  test("waits for the context update before confirming it", async () => {
    testClient.holdContextUpdate();
    await page.find("#user-id").setValue("user-123");

    await page.find("form").trigger("submit");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(contextUpdatesFromPage()).toEqual([{ id: "user-123" }]);
    expect(savedMessage().classes()).toContain("hidden");

    testClient.completeContextUpdate();

    await vi.waitFor(() => expect(savedMessage().classes()).not.toContain("hidden"));
  });

  test("clears the fields and sends an empty context", async () => {
    await page.find("#user-id").setValue("user-123");
    await page.find("#user-name").setValue("Ada");
    await page.find("#user-role").setValue("admin");
    await page.find("form").trigger("submit");
    await vi.waitFor(() => expect(contextUpdatesFromPage()).toHaveLength(1));

    await page.find("button[type=button]").trigger("click");

    await vi.waitFor(() => expect(clearedMessage().classes()).not.toContain("hidden"));
    expect(contextUpdatesFromPage().at(-1)).toStrictEqual({});
    expect((page.find("#user-id").element as HTMLInputElement).value).toBe("");
    expect((page.find("#user-name").element as HTMLInputElement).value).toBe("");
    expect((page.find("#user-role").element as HTMLInputElement).value).toBe("");
  });
});
