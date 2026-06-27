import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { commands } from "vitest/browser";
import { render, screen, fireEvent } from "@testing-library/vue";
import { defineComponent } from "vue";
import { ConfigDirectorPlugin } from "../src/plugin";
import { initializeClient } from "../src/client";
import { useConfigValue } from "../src/composables/useConfigValue";
import { useClientStatus } from "../src/composables/useClientStatus";
import { useContext } from "../src/composables/useContext";
import { SSE_URL, createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
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
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: '<div data-testid="target">{{ value }}</div>',
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
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: '<div data-testid="target">{{ value }}</div>',
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
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
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
                id: "00000000-0000-0000-0000-0000000003e8",
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
                id: "00000000-0000-0000-0000-0000000003e8",
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
          plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", context: { id: "user-1" }, logger }]],
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

  describe("instanceId", () => {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it("sends a generated instanceId on the SSE connection", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: '<div data-testid="target">{{ value }}</div>',
      });

      render(TestComponent, {
        global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
      });

      await screen.findByText("Hello", undefined, { timeout: 1_000 });

      const payloads = await commands.mswGetPayloads();
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
    });

    it("keeps the same instanceId across reconnects when context changes", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
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
                id: "00000000-0000-0000-0000-0000000003e8",
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
          plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", context: { id: "user-1" }, logger }]],
        },
      });

      await screen.findByText("before-context-update", undefined, { timeout: 1_000 });

      await fireEvent.click(screen.getByTestId("update-btn"));

      await screen.findByText("after-context-update", undefined, { timeout: 1_000 });

      const payloads = await commands.mswGetPayloads();
      expect(payloads).toHaveLength(2);
      expect((payloads[0] as any)?.instanceId).toMatch(UUID_PATTERN);
      expect((payloads[1] as any)?.instanceId).toBe((payloads[0] as any)?.instanceId);
    });
  });

  describe("hooks", () => {
    it("calls the clientReady hook when the client connects", async () => {
      const clientReadyHook = vi.fn();

      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

      const TestComponent = defineComponent({
        setup: () => ({}),
        template: "<div />",
      });

      render(TestComponent, {
        global: {
          plugins: [
            [ConfigDirectorPlugin, { sdkKey: "dummy-key", logger, hooks: { clientReady: clientReadyHook } }],
          ],
        },
      });

      await vi.waitFor(() => {
        expect(clientReadyHook).toHaveBeenCalledOnce();
      });
    });

    it("calls the configsUpdated hook when configs are received", async () => {
      const configsUpdatedHook = vi.fn();

      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup: () => ({}),
        template: "<div />",
      });

      render(TestComponent, {
        global: {
          plugins: [
            [
              ConfigDirectorPlugin,
              { sdkKey: "dummy-key", logger, hooks: { configsUpdated: configsUpdatedHook } },
            ],
          ],
        },
      });

      await vi.waitFor(() => {
        expect(configsUpdatedHook).toHaveBeenCalledWith(
          expect.objectContaining({ keys: ["example-config"] }),
        );
      });
    });

    it("calls the configEvaluated hook when a config value is read", async () => {
      const configEvaluatedHook = vi.fn();

      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useConfigValue("example-config", "Default");
        },
        template: '<div data-testid="target">{{ value }}</div>',
      });

      render(TestComponent, {
        global: {
          plugins: [
            [
              ConfigDirectorPlugin,
              { sdkKey: "dummy-key", logger, hooks: { configEvaluated: configEvaluatedHook } },
            ],
          ],
        },
      });

      await screen.findByText("Hello", undefined, { timeout: 1_000 });

      await vi.waitFor(() => {
        expect(configEvaluatedHook).toHaveBeenCalledWith(
          expect.objectContaining({ evaluation: expect.objectContaining({ key: "example-config" }) }),
        );
      });
    });

    it("accepts an array of handlers for the same hook event", async () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      await commands.mswUseSseHandler(SSE_URL, [[{ data: full() }]]);

      const TestComponent = defineComponent({
        setup: () => ({}),
        template: "<div />",
      });

      render(TestComponent, {
        global: {
          plugins: [
            [ConfigDirectorPlugin, { sdkKey: "dummy-key", logger, hooks: { clientReady: [hook1, hook2] } }],
          ],
        },
      });

      await vi.waitFor(() => {
        expect(hook1).toHaveBeenCalledOnce();
        expect(hook2).toHaveBeenCalledOnce();
      });
    });
  });

  describe("useClientStatus", () => {
    it("is 'loading' before configs are received and 'ready' after", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            delay: 100,
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const TestComponent = defineComponent({
        setup() {
          return useClientStatus();
        },
        template: '<div data-testid="status">{{ readyStatus }}</div>',
      });

      render(TestComponent, {
        global: { plugins: [[ConfigDirectorPlugin, { sdkKey: "dummy-key", logger }]] },
      });

      expect(screen.getByTestId("status")).toHaveTextContent("loading");
      await screen.findByText("ready", undefined, { timeout: 1_000 });
    });
  });
});

describe("pre-initialized client flow", () => {
  beforeAll(async () => {
    await commands.mswSetup();
  });

  afterAll(async () => {
    await commands.mswTeardown();
  });

  describe("initializeClient", () => {
    it("resolves with a ready client that has already fetched config values", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const client = await initializeClient({ sdkKey: "dummy-key", logger });

      expect(client.isReady).toBe(true);
      expect(client.getValue("example-config", "Default")).toBe("Hello");
    });
  });

  describe("ConfigDirectorPlugin with pre-initialized client", () => {
    it("status is immediately 'ready' with no loading phase", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const client = await initializeClient({ sdkKey: "dummy-key", logger });

      const TestComponent = defineComponent({
        setup: () => useClientStatus(),
        template: '<div data-testid="status">{{ readyStatus }}</div>',
      });

      render(TestComponent, { global: { plugins: [[ConfigDirectorPlugin, client]] } });

      expect(screen.getByTestId("status")).toHaveTextContent("ready");
    });

    it("config value is immediately available without flickering through the default", async () => {
      await commands.mswUseSseHandler(SSE_URL, [
        [
          {
            data: full({
              "example-config": {
                id: "00000000-0000-0000-0000-0000000003e8",
                key: "example-config",
                type: "string",
                value: "Hello",
              },
            }),
          },
        ],
      ]);

      const client = await initializeClient({ sdkKey: "dummy-key", logger });

      const TestComponent = defineComponent({
        setup: () => useConfigValue("example-config", "Default"),
        template: `
          <div>
            <div data-testid="value">{{ value }}</div>
            <div data-testid="loading">{{ loading }}</div>
          </div>
        `,
      });

      render(TestComponent, { global: { plugins: [[ConfigDirectorPlugin, client]] } });

      expect(screen.getByTestId("value")).toHaveTextContent("Hello");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
  });
});
