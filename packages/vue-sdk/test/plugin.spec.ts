import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { commands } from "vitest/browser";
import { render, screen, fireEvent } from "@testing-library/vue";
import { defineComponent } from "vue";
import { ConfigDirectorPlugin } from "../src/plugin";
import { useConfigValue } from "../src/composables/useConfigValue";
import { useClientStatus } from "../src/composables/useClientStatus";
import { useContext } from "../src/composables/useContext";
import { SSE_URL, createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

const full = (configs: object = {}) => ({
  environmentId: 100,
  projectId: 200,
  kind: "full",
  configs,
});

describe("Vue plugin composables", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  describe("useConfigValue", () => {
    it("retrieves the value for the given config key", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: "<div data-testid=\"target\">{{ value }}</div>",
      });

      render(TestComponent, {
        global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
      });

      await screen.findByText("Hello", undefined, { timeout: 1_000 });
      expect(screen.getByTestId("target")).toHaveTextContent("Hello");
    });

    it("returns the default value until the configs are loaded", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            delay: 100,
            data: full({
              "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: "<div data-testid=\"target\">{{ value }}</div>",
      });

      render(TestComponent, {
        global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
      });

      expect(screen.getByTestId("target")).toHaveTextContent("Default");
      await screen.findByText("Hello", undefined, { timeout: 1_000 });
      expect(screen.getByTestId("target")).toHaveTextContent("Hello");
    });

    it("loading flag is true until the configs are loaded", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            delay: 100,
            data: full({
              "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: "<div data-testid=\"target\">{{ loading ? 'Loading' : value }}</div>",
      });

      render(TestComponent, {
        global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
      });

      expect(screen.getByTestId("target")).toHaveTextContent("Loading");
      await screen.findByText("Hello", undefined, { timeout: 1_000 });
      expect(screen.getByTestId("target")).toHaveTextContent("Hello");
    });

    it("calls updateContext and reconnects when context changes", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: 1000,
                key: "example-config",
                type: "string",
                value: "before-context-update",
              },
            }),
          },
        ],
        [
          {
            data: full({
              "example-config": {
                id: 1000,
                key: "example-config",
                type: "string",
                value: "after-context-update",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          const { value } = useConfigValue("example-config", "Default");
          const { updateContext } = useContext();
          return { value, updateContext };
        },
        template: `
          <div>
            <div data-testid="target">{{ value }}</div>
            <button data-testid="update-btn" @click="updateContext({ id: 'user-2' })">Update</button>
          </div>
        `,
      });

      render(TestComponent, {
        global: {
          plugins: [
            [ConfigDirectorPlugin, { sdkKey: "dummy-key", context: { id: "user-1" }, logger }],
          ],
        },
      });

      await screen.findByText("before-context-update", undefined, { timeout: 1_000 });

      await fireEvent.click(screen.getByTestId("update-btn"));

      await screen.findByText("after-context-update", undefined, { timeout: 1_000 });

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);
      expect((payloads[1] as any)?.givenContext).toMatchObject({ id: "user-2" });
    });
  });

  describe("useClientStatus", () => {
    it("is 'loading' before configs are received and 'ready' after", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            delay: 100,
            data: full({
              "example-config": { id: 1000, key: "example-config", type: "string", value: "Hello" },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useClientStatus();
        },
        template: "<div data-testid=\"status\">{{ readyStatus }}</div>",
      });

      render(TestComponent, {
        global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
      });

      expect(screen.getByTestId("status")).toHaveTextContent("loading");
      await screen.findByText("ready", undefined, { timeout: 1_000 });
    });
  });
});
