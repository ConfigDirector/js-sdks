import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { createTestClient, installTestClient } from "@configdirector/react-native-sdk/testing";
import type { TestClient } from "@configdirector/react-native-sdk/testing";

describe("app", () => {
  let testClient: TestClient;
  let uninstallTestClient: () => void;

  beforeEach(() => {
    testClient = createTestClient({ values: { "integer-config": 42, "day-of-the-week-config": "Monday" } });
    uninstallTestClient = installTestClient(testClient);
  });

  afterEach(() => {
    uninstallTestClient();
    testClient.client.dispose();
  });

  test("the root layout's provider serves the installed test client's values", async () => {
    await renderRouter("./app");

    expect(await screen.findByText("Monday")).toBeOnTheScreen();
    expect(screen.getByTestId("integer-config-value")).toHaveTextContent("42");
    expect(testClient.contextUpdates).toEqual([{}]);
  });

  test("the Context tab sends the entered user through the installed test client", async () => {
    await renderRouter("./app");
    await screen.findByText("Monday");

    await fireEvent.press(screen.getByRole("button", { name: /^Context,/ }));
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. user-123"), "user-123");
    await fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(testClient.contextUpdates).toHaveLength(2));
    expect(testClient.contextUpdates[1]).toStrictEqual({ id: "user-123", name: "", traits: { role: "" } });
  });
});
