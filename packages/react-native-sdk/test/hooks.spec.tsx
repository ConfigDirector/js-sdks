import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { ConfigDirectorProvider } from "../src/provider";
import { useConfigValue, useContext, useClient } from "../src/hooks";
import { ConfigDirectorReactContextError } from "../src/errors";
import { buildResponse, message, full, sleep, createStubbedLogger } from "./helpers";

const logger = createStubbedLogger();

const exampleConfig = {
  id: "00000000-0000-0000-0000-0000000003e8",
  key: "example-config",
  type: "string",
  value: "Hello",
};

const wrapper =
  (sdkKey = "dummy-key") =>
  ({ children }: { children: React.ReactNode }) => (
    <ConfigDirectorProvider sdkKey={sdkKey} logger={logger}>
      {children}
    </ConfigDirectorProvider>
  );

describe("hooks", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof globalThis, "fetch", any>>;

  beforeAll(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  const mockFetchWith = (response: () => Promise<Response>) => {
    fetchSpy.mockImplementation(async (url) => {
      if ((url as string).toString().includes("telemetry")) {
        return Response.json({}, { status: 204 });
      } else {
        return await response();
      }
    });
  };

  describe("useConfigValue", () => {
    it("retrieves the value for the given config key", async () => {
      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full({ "example-config": exampleConfig })));
            },
          }),
        ),
      );

      const { result } = renderHook(() => useConfigValue("example-config", "Default"), {
        wrapper: wrapper(),
      });

      await waitFor(() => expect(result.current.value).toBe("Hello"), {
        timeout: 1_000,
      });
    });

    it("returns the default value until the configs are loaded", async () => {
      mockFetchWith(async () => {
        await sleep(100);
        return buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full({ "example-config": exampleConfig })));
            },
          }),
        );
      });

      const { result } = renderHook(() => useConfigValue("example-config", "Default"), {
        wrapper: wrapper(),
      });

      expect(result.current.value).toBe("Default");
      await waitFor(() => expect(result.current.value).toBe("Hello"), {
        timeout: 1_000,
      });
    });

    it("returns the parsed object when the server sends a json config and the default is an object", async () => {
      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(
                  full({
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      value: JSON.stringify({ greeting: "hello", count: 3 }),
                    },
                  }),
                ),
              );
            },
          }),
        ),
      );

      const { result } = renderHook(() => useConfigValue("json-config", { greeting: "default", count: 0 }), {
        wrapper: wrapper(),
      });

      await waitFor(() => expect(result.current.value).toEqual({ greeting: "hello", count: 3 }), {
        timeout: 1_000,
      });
    });

    it("returns the default object when the json config key is not present in the server response", async () => {
      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full()));
            },
          }),
        ),
      );

      const { result } = renderHook(() => useConfigValue("json-config", { greeting: "default" }), {
        wrapper: wrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 1_000 });
      expect(result.current.value).toEqual({ greeting: "default" });
    });

    it("returns the raw json string when the default value type is string", async () => {
      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message(
                  full({
                    "json-config": {
                      id: "00000000-0000-0000-0000-000000000001",
                      key: "json-config",
                      type: "json",
                      value: JSON.stringify({ greeting: "hello" }),
                    },
                  }),
                ),
              );
            },
          }),
        ),
      );

      const { result } = renderHook(() => useConfigValue("json-config", "{}"), { wrapper: wrapper() });

      await waitFor(() => expect(result.current.value).toBe(JSON.stringify({ greeting: "hello" })), {
        timeout: 1_000,
      });
    });

    it("is 'loading' until configs are loaded", async () => {
      mockFetchWith(async () => {
        await sleep(100);
        return buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full({ "example-config": exampleConfig })));
            },
          }),
        );
      });

      const { result } = renderHook(() => useConfigValue("example-config", "Default"), {
        wrapper: wrapper(),
      });

      expect(result.current.loading).toBe(true);
      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 1_000,
      });
      expect(result.current.value).toBe("Hello");
    });
  });

  describe("useContext", () => {
    it("throws when used outside of a ConfigDirectorProvider", () => {
      expect(() => renderHook(() => useContext())).toThrow(ConfigDirectorReactContextError);
    });

    it("returns an updateContext function that reconnects with the new context", async () => {
      mockFetchWith(async () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full({ "example-config": exampleConfig })));
            },
          }),
        ),
      );

      const { result } = renderHook(() => useContext(), {
        wrapper: wrapper(),
      });

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1), {
        timeout: 1_000,
      });

      await act(async () => {
        await result.current.updateContext({ id: "user-123" });
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [, init] = fetchSpy.mock.calls[1] as [unknown, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.givenContext).toMatchObject({ id: "user-123" });
    });
  });

  describe("useClient", () => {
    it("throws when used outside of a ConfigDirectorProvider", () => {
      expect(() => renderHook(() => useClient())).toThrow(ConfigDirectorReactContextError);
    });

    it("returns the client instance", async () => {
      fetchSpy.mockImplementation(async (url) => {
        if ((url as string).toString().includes("telemetry")) {
          return Response.json({}, { status: 204 });
        }
        return buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(message(full({ "example-config": exampleConfig })));
            },
          }),
        );
      });

      const { result } = renderHook(() => useClient(), {
        wrapper: wrapper(),
      });

      expect(result.current.client).toBeDefined();
      expect(typeof result.current.client.getValue).toBe("function");
      expect(typeof result.current.client.updateContext).toBe("function");

      await waitFor(() => expect(result.current.client.getValue("example-config", "Default")).toBe("Hello"), {
        timeout: 1_000,
      });
    });
  });
});
