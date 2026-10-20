// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ConfigDirectorProvider } from "../src/client/ConfigDirectorProvider";
import { useConfigDirectorStatus, useConfigValue } from "../src/client/hooks";

type Observation = { status: string; greeting: string };

const observations: Observation[] = [];

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

    const lastObservation = () => observations[observations.length - 1];
    expect(observations[0]).toEqual({ status: "loading", greeting: "hello from the cell" });
    await vi.waitFor(() => expect(lastObservation()?.status).toBe("ready"));
    expect(lastObservation()).toEqual({ status: "ready", greeting: "hello from the cell" });
    expect(view.getByTestId("greeting").textContent).toBe("hello from the cell");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
