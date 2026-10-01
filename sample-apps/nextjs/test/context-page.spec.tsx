import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";
import { createTestClient } from "@configdirector/nextjs-sdk/client/testing";
import type { TestClient } from "@configdirector/nextjs-sdk/client/testing";
import ContextPage from "../app/context/page";

describe("context page", () => {
  let testClient: TestClient;

  beforeEach(async () => {
    testClient = createTestClient();
    await testClient.client.initialize();
    render(
      <ConfigDirectorProvider client={testClient.client}>
        <ContextPage />
      </ConfigDirectorProvider>,
    );
  });

  afterEach(() => testClient.client.dispose());

  const enter = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

  test("sends the entered user as the context", async () => {
    enter("User ID", "user-123");
    enter("User Name", "Ada");
    enter("User Role", "admin");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Context saved")).not.toHaveClass("hidden"));
    expect(testClient.contextUpdates).toEqual([
      {},
      { id: "user-123", name: "Ada", traits: { role: "admin" } },
    ]);
  });

  test("leaves the empty fields out of the context", async () => {
    enter("User Name", "Ada");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Context saved")).not.toHaveClass("hidden"));
    expect(testClient.contextUpdates).toEqual([{}, { name: "Ada" }]);
  });

  test("waits for the context update before confirming it", async () => {
    testClient.holdContextUpdate();
    enter("User ID", "user-123");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(testClient.contextUpdates).toHaveLength(2);
    expect(screen.getByText("Context saved")).toHaveClass("hidden");

    act(() => testClient.completeContextUpdate());

    await waitFor(() => expect(screen.getByText("Context saved")).not.toHaveClass("hidden"));
  });

  test("clears the fields and sends an empty context", async () => {
    enter("User ID", "user-123");
    enter("User Name", "Ada");
    enter("User Role", "admin");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(screen.getByText("Context cleared")).not.toHaveClass("hidden"));
    expect(testClient.contextUpdates).toStrictEqual([{}, {}]);
    expect(screen.getByLabelText("User ID")).toHaveValue("");
    expect(screen.getByLabelText("User Name")).toHaveValue("");
    expect(screen.getByLabelText("User Role")).toHaveValue("");
  });
});
