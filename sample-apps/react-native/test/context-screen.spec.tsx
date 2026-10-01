import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ConfigDirectorProvider } from "@configdirector/react-native-sdk";
import { createTestClient } from "@configdirector/react-native-sdk/testing";
import type { TestClient } from "@configdirector/react-native-sdk/testing";
import ContextScreen from "@/app/(tabs)/context";

describe("context screen", () => {
  let testClient: TestClient;

  beforeEach(async () => {
    testClient = createTestClient();
    await testClient.client.initialize();
    await render(
      <ConfigDirectorProvider client={testClient.client}>
        <ContextScreen />
      </ConfigDirectorProvider>,
    );
  });

  afterEach(() => testClient.client.dispose());

  const enter = (placeholder: string, text: string) =>
    fireEvent.changeText(screen.getByPlaceholderText(placeholder), text);

  test("sends the entered user as the context", async () => {
    await enter("e.g. user-123", "user-123");
    await enter("e.g. Jane Smith", "Ada");
    await enter("e.g. admin, viewer, editor", "admin");

    await fireEvent.press(screen.getByText("Save"));

    await waitFor(() => expect(testClient.contextUpdates).toHaveLength(2));
    expect(testClient.contextUpdates[1]).toStrictEqual({
      id: "user-123",
      name: "Ada",
      traits: { role: "admin" },
    });
  });

  test("clears the fields and sends an empty context", async () => {
    await enter("e.g. user-123", "user-123");
    await enter("e.g. Jane Smith", "Ada");
    await enter("e.g. admin, viewer, editor", "admin");

    await fireEvent.press(screen.getByText("Clear"));

    await waitFor(() => expect(testClient.contextUpdates).toHaveLength(2));
    expect(testClient.contextUpdates[1]).toStrictEqual({});
    expect(screen.getByPlaceholderText("e.g. user-123")).toHaveDisplayValue("");
    expect(screen.getByPlaceholderText("e.g. Jane Smith")).toHaveDisplayValue("");
    expect(screen.getByPlaceholderText("e.g. admin, viewer, editor")).toHaveDisplayValue("");
  });
});
