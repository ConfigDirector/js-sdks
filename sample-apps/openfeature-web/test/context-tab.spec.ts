import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/web-sdk";
import { initContextTab } from "../src/context-tab";
import { input, isShown, renderSamplePage } from "./sample-page";

describe("context tab", () => {
  beforeEach(async () => {
    renderSamplePage();
    await OpenFeature.setProviderAndWait(new TypedInMemoryProvider({}));
    initContextTab();
  });

  afterEach(async () => {
    await OpenFeature.clearProviders();
    await OpenFeature.clearContexts();
  });

  const save = () => document.getElementById("save-button")!.click();

  test("sets the entered user as the evaluation context", async () => {
    input("user-id-input").value = "user-123";
    input("user-name-input").value = "Ada";
    input("user-role-input").value = "admin";

    save();

    await vi.waitFor(() => expect(isShown("saved-message")).toBe(true));
    expect(OpenFeature.getContext()).toStrictEqual({
      targetingKey: "user-123",
      name: "Ada",
      traits: { role: "admin" },
    });
  });

  test("leaves the empty fields out of the evaluation context", async () => {
    input("user-name-input").value = "Ada";

    save();

    await vi.waitFor(() => expect(isShown("saved-message")).toBe(true));
    expect(OpenFeature.getContext()).toStrictEqual({ name: "Ada" });
  });

  test("clears the fields and the evaluation context", async () => {
    input("user-id-input").value = "user-123";
    input("user-name-input").value = "Ada";
    save();
    await vi.waitFor(() => expect(isShown("saved-message")).toBe(true));

    document.getElementById("clear-button")!.click();

    await vi.waitFor(() => expect(isShown("cleared-message")).toBe(true));
    expect(OpenFeature.getContext()).toStrictEqual({});
    expect([
      input("user-id-input").value,
      input("user-name-input").value,
      input("user-role-input").value,
    ]).toEqual(["", "", ""]);
  });
});
