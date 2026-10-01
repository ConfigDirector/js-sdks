import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";
import { createTestClient } from "@configdirector/nextjs-sdk/client/testing";
import type { TestClient } from "@configdirector/nextjs-sdk/client/testing";
import FlagsPage from "../app/page";

const SAMPLE_VALUES = {
  "temporary-feature-flag": false,
  "permanent-kill-switch": true,
  "integer-config": 42,
  "day-of-the-week-config": "Monday",
  "json-value-config": { theme: "dark" },
};

const configValueText = (key: string) =>
  document.querySelector(`[data-config-key="${key}"]`)?.lastElementChild?.textContent;

describe("flags page", () => {
  let testClient: TestClient;

  beforeEach(() => {
    testClient = createTestClient({ values: SAMPLE_VALUES });
  });

  afterEach(() => testClient.client.dispose());

  const renderPage = () =>
    render(
      <ConfigDirectorProvider client={testClient.client}>
        <FlagsPage />
      </ConfigDirectorProvider>,
    );

  test("shows every config value once the client is ready", async () => {
    renderPage();

    await waitFor(() => expect(configValueText("integer-config")).toBe("42"));
    expect(configValueText("temporary-feature-flag")).toBe("OFF");
    expect(configValueText("permanent-kill-switch")).toBe("ON");
    expect(configValueText("day-of-the-week-config")).toBe("Monday");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({ theme: "dark" });
  });

  test("shows the in-code default values until the client is ready", async () => {
    testClient.holdInitialization();
    renderPage();

    expect(configValueText("temporary-feature-flag")).toBe("ON");
    expect(configValueText("permanent-kill-switch")).toBe("OFF");
    expect(configValueText("integer-config")).toBe("10");
    expect(configValueText("day-of-the-week-config")).toBe("Friday");
    expect(JSON.parse(configValueText("json-value-config")!)).toEqual({});

    act(() => testClient.completeInitialization());

    await waitFor(() => expect(configValueText("integer-config")).toBe("42"));
  });

  test("re-renders a card when its config changes", async () => {
    renderPage();
    await waitFor(() => expect(configValueText("integer-config")).toBe("42"));

    act(() => {
      testClient.setValue("permanent-kill-switch", false);
      testClient.setValue("integer-config", 7);
    });

    expect(configValueText("permanent-kill-switch")).toBe("OFF");
    expect(configValueText("integer-config")).toBe("7");
  });

  test("falls back to the in-code default value when a config is removed", async () => {
    renderPage();
    await waitFor(() => expect(configValueText("day-of-the-week-config")).toBe("Monday"));

    act(() => testClient.removeValue("day-of-the-week-config"));

    expect(configValueText("day-of-the-week-config")).toBe("Friday");
    expect(configValueText("integer-config")).toBe("42");
  });
});
