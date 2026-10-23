// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createBrowserClient } from "@js-browser-client/index";
import { ConfigDirectorProvider } from "../src/client/ConfigDirectorProvider";
import { useConfigDirectorStatus, useConfigValue } from "../src/client/hooks";

type Observation = { status: string; greeting: string };

const observations: Observation[] = [];

const lastObservation = () => observations[observations.length - 1];

const Greeting = () => {
  const { readyStatus } = useConfigDirectorStatus();
  const { value } = useConfigValue("greeting", "in-code default");
  observations.push({ status: readyStatus, greeting: value });
  return <div data-testid="greeting">{value}</div>;
};

describe("client ConfigDirectorProvider in offline mode", () => {
  afterEach(() => {
    cleanup();
    observations.length = 0;
  });

  test("renders the server's value while loading on the first render and the same value once ready, without a key or a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const view = render(
      <ConfigDirectorProvider
        mode="offline"
        values={{ greeting: "hello from the cell" }}
        initialConfigs={{
          greeting: { id: "offline:greeting", key: "greeting", type: "string", value: "hello from the cell" },
        }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    expect(observations[0]).toEqual({ status: "loading", greeting: "hello from the cell" });
    await vi.waitFor(() => expect(lastObservation()?.status).toBe("ready"));
    expect(lastObservation()).toEqual({ status: "ready", greeting: "hello from the cell" });
    expect(view.getByTestId("greeting").textContent).toBe("hello from the cell");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("reports ready again with the same value after the context prop changes", async () => {
    const view = render(
      <ConfigDirectorProvider mode="offline" values={{ greeting: "hello offline" }} context={{ id: "user-1" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );
    await vi.waitFor(() => expect(lastObservation()?.status).toBe("ready"));

    view.rerender(
      <ConfigDirectorProvider mode="offline" values={{ greeting: "hello offline" }} context={{ id: "user-2" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(lastObservation()?.status).toBe("ready"));
    expect(lastObservation()).toEqual({ status: "ready", greeting: "hello offline" });
  });

  test("is ready at once with deferInitialization on, with no context and no request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <ConfigDirectorProvider mode="offline" values={{ greeting: "hello offline" }} deferInitialization>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(lastObservation()?.status).toBe("ready"));
    expect(lastObservation()).toEqual({ status: "ready", greeting: "hello offline" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("reports ready when given a ready client and another context", async () => {
    const client = createBrowserClient(
      { connection: { mode: "offline", values: { greeting: "hello offline" } } },
      { sdkName: "nextjs-sdk", sdkVersion: "test" },
    );
    await client.initialize({ id: "user-1" });

    render(
      <ConfigDirectorProvider client={client} context={{ id: "user-2" }}>
        <Greeting />
      </ConfigDirectorProvider>,
    );

    await vi.waitFor(() => expect(client.context).toEqual({ id: "user-2" }));
    await vi.waitFor(() => expect(lastObservation()?.status).toBe("ready"));
    expect(lastObservation()).toEqual({ status: "ready", greeting: "hello offline" });
    client.dispose();
  });
});
