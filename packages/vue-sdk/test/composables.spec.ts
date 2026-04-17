import { describe, it, expect } from "vitest";
import { render } from "@testing-library/vue";
import { defineComponent, onErrorCaptured } from "vue";
import { ConfigDirectorPlugin } from "../src/plugin";
import { useClient } from "../src/composables/useClient";
import { useClientStatus } from "../src/composables/useClientStatus";
import { useConfigValue } from "../src/composables/useConfigValue";
import { useContext } from "../src/composables/useContext";
import { ConfigDirectorInitializationError } from "@shared/errors";
import { createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

const captureSetupError = (component: ReturnType<typeof defineComponent>): unknown => {
  let caughtError: unknown;
  const Wrapper = defineComponent({
    setup() {
      onErrorCaptured((err) => {
        caughtError = err;
        return false;
      });
      return {};
    },
    components: { Testee: component },
    template: "<Testee />",
  });
  render(Wrapper);
  return caughtError;
};

describe("composable injection errors (plugin not installed)", () => {
  it("useClient throws ConfigDirectorInitializationError", () => {
    const TestComponent = defineComponent({ setup: () => useClient(), template: "<div />" });
    expect(captureSetupError(TestComponent)).toBeInstanceOf(ConfigDirectorInitializationError);
  });

  it("useClientStatus throws ConfigDirectorInitializationError", () => {
    const TestComponent = defineComponent({ setup: () => useClientStatus(), template: "<div />" });
    expect(captureSetupError(TestComponent)).toBeInstanceOf(ConfigDirectorInitializationError);
  });

  it("useConfigValue throws ConfigDirectorInitializationError", () => {
    const TestComponent = defineComponent({
      setup: () => useConfigValue("key", "default"),
      template: "<div />",
    });
    expect(captureSetupError(TestComponent)).toBeInstanceOf(ConfigDirectorInitializationError);
  });

  it("useContext throws ConfigDirectorInitializationError", () => {
    const TestComponent = defineComponent({ setup: () => useContext(), template: "<div />" });
    expect(captureSetupError(TestComponent)).toBeInstanceOf(ConfigDirectorInitializationError);
  });
});

describe("useClient", () => {
  it("returns the client instance when plugin is installed", () => {
    let capturedClient: unknown;
    const TestComponent = defineComponent({
      setup() {
        const { client } = useClient();
        capturedClient = client;
        return {};
      },
      template: "<div />",
    });

    render(TestComponent, {
      global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
    });

    expect(capturedClient).toBeDefined();
    expect(capturedClient).toHaveProperty("isReady");
    expect(capturedClient).toHaveProperty("context");
  });
});
