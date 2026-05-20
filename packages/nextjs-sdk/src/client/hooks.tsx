"use client";

import { useContext as useReactContext } from "react";
import { reactContext } from "./context";
import type { ConfigDirectorContext, ConfigValueType } from "@js-browser-client/index";
import { parseConfigValue } from "@shared/value-parser";
import { ConfigDirectorNextContextError } from "./errors";
import type { ClientStatus } from "./types";

const noContextError = () =>
  new ConfigDirectorNextContextError(
    "The ConfigDirector client was not found in the React context. " +
      "Make sure the component using this hook is inside a <ConfigDirectorProvider>.",
  );

/**
 * Returns the evaluated value of a config key.
 *
 * During SSR and before the browser client finishes initializing, returns the value from
 * `initialConfigs` (if provided to the provider) to avoid a flash of wrong content on hydration.
 * Once the browser client is ready, returns live-evaluated values and re-renders whenever configs
 * change.
 *
 * Must be used inside a `<ConfigDirectorProvider>`.
 */
export const useConfigValue = <T extends ConfigValueType>(
  key: string,
  defaultValue: T,
): { value: T; readyStatus: ClientStatus; loading: boolean } => {
  const configDirectorReactContext = useReactContext(reactContext);
  if (!configDirectorReactContext) throw noContextError();

  // The client is undefined during SSR and briefly during the first client render before componentDidMount
  // fires. Fall through to initialConfigs in both cases so the rendered output matches the server HTML,
  // avoiding a hydration mismatch.
  const initialConfigState = configDirectorReactContext.initialConfigs?.[key];
  const value = configDirectorReactContext.client?.isReady
    ? configDirectorReactContext.client.getValue(key, defaultValue)
    : initialConfigState
      ? parseConfigValue(initialConfigState, defaultValue).parsedValue
      : defaultValue;

  return {
    value,
    readyStatus: configDirectorReactContext.status,
    loading: configDirectorReactContext.status === "loading",
  };
};

/**
 * Returns an `updateContext` function to update the user context on the browser client.
 * Triggers re-evaluation of all watched config values.
 *
 * Must be used inside a `<ConfigDirectorProvider>`.
 */
export const useContext = (): { updateContext: (context: ConfigDirectorContext) => Promise<void> } => {
  const configDirectorReactContext = useReactContext(reactContext);
  if (!configDirectorReactContext) throw noContextError();

  return {
    // client is undefined during SSR and briefly before componentDidMount; no-op until ready
    updateContext: async (context: ConfigDirectorContext) => {
      await configDirectorReactContext.client?.updateContext(context);
    },
  };
};

/**
 * Returns the raw browser client for advanced use cases.
 *
 * Must be used inside a `<ConfigDirectorProvider>`.
 */
export const useClient = () => {
  const configDirectorReactContext = useReactContext(reactContext);
  if (!configDirectorReactContext?.client) throw noContextError();
  return { client: configDirectorReactContext.client };
};

/**
 * Returns the current connection status of the browser client.
 *
 * - `"loading"` — client is initializing
 * - `"ready"` — client received configs from the server
 * - `"default"` — initialization timed out; hooks return default or initial values
 *
 * Must be used inside a `<ConfigDirectorProvider>`.
 */
export const useConfigDirectorStatus = (): { readyStatus: ClientStatus; loading: boolean } => {
  const configDirectorReactContext = useReactContext(reactContext);
  if (!configDirectorReactContext) throw noContextError();
  return {
    readyStatus: configDirectorReactContext.status,
    loading: configDirectorReactContext.status === "loading",
  };
};
