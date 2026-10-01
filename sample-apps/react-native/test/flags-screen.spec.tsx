import { act, render, screen } from "@testing-library/react-native";
import { ConfigDirectorProvider } from "@configdirector/react-native-sdk";
import { createTestClient } from "@configdirector/react-native-sdk/testing";
import type { TestClient } from "@configdirector/react-native-sdk/testing";
import FlagsScreen from "@/app/(tabs)/index";

const SAMPLE_VALUES = {
  "temporary-feature-flag": false,
  "permanent-kill-switch": true,
  "integer-config": 42,
  "day-of-the-week-config": "Monday",
  "json-value-config": { theme: "dark" },
};

const valueText = (key: string) => screen.getByTestId(`${key}-value`);

describe("flags screen", () => {
  let testClient: TestClient;

  beforeEach(() => {
    testClient = createTestClient({ values: SAMPLE_VALUES });
  });

  afterEach(() => testClient.client.dispose());

  const renderScreen = () =>
    render(
      <ConfigDirectorProvider client={testClient.client}>
        <FlagsScreen />
      </ConfigDirectorProvider>,
    );

  test("shows every config value once the client is ready", async () => {
    await renderScreen();

    expect(await screen.findByText("Monday")).toBeOnTheScreen();
    expect(valueText("temporary-feature-flag")).toHaveTextContent("OFF");
    expect(valueText("permanent-kill-switch")).toHaveTextContent("ON");
    expect(valueText("integer-config")).toHaveTextContent("42");
    expect(valueText("day-of-the-week-config")).toHaveTextContent("Monday");
    expect(JSON.parse(String(valueText("json-value-config").props.children))).toEqual({ theme: "dark" });
  });

  test("shows the in-code default values until the client is ready", async () => {
    testClient.holdInitialization();
    await renderScreen();

    expect(valueText("temporary-feature-flag")).toHaveTextContent("ON");
    expect(valueText("permanent-kill-switch")).toHaveTextContent("OFF");
    expect(valueText("integer-config")).toHaveTextContent("10");
    expect(valueText("day-of-the-week-config")).toHaveTextContent("Friday");
    expect(JSON.parse(String(valueText("json-value-config").props.children))).toEqual({});

    await act(() => testClient.completeInitialization());

    expect(await screen.findByText("Monday")).toBeOnTheScreen();
    expect(valueText("integer-config")).toHaveTextContent("42");
  });

  test("re-renders a value when its config changes", async () => {
    await renderScreen();
    await screen.findByText("Monday");

    await act(() => {
      testClient.setValue("permanent-kill-switch", false);
      testClient.setValue("integer-config", 7);
    });

    expect(valueText("permanent-kill-switch")).toHaveTextContent("OFF");
    expect(valueText("integer-config")).toHaveTextContent("7");
  });

  test("falls back to the in-code default value when a config is removed", async () => {
    await renderScreen();
    await screen.findByText("Monday");

    await act(() => testClient.removeValue("day-of-the-week-config"));

    expect(valueText("day-of-the-week-config")).toHaveTextContent("Friday");
    expect(valueText("integer-config")).toHaveTextContent("42");
  });
});
