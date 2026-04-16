import { useContext } from "react";
import { reactContext } from "./context";
import type {
  ConfigDirectorContext,
  ConfigValueType,
} from "@js-client-core/index";
import { ConfigDirectorReactContextError } from "./errors";
import type { ClientStatus } from "./types";

const noContextError = () => {
  return new ConfigDirectorReactContextError(
    "The ConfigDirector client was not found in the React context. Please make sure the component using this hook is inside the context of a ConfigDirectorProvider.",
  );
};

const useConfigValue = <T extends ConfigValueType>(
  key: string,
  defaultValue: T,
): {
  value: T;
  readyStatus: ClientStatus;
  loading: boolean;
} => {
  const configDirectorReactContext = useContext(reactContext);
  if (!configDirectorReactContext?.client) {
    throw noContextError();
  }

  const value = configDirectorReactContext.client.getValue(key, defaultValue);

  return {
    value,
    readyStatus: configDirectorReactContext.status,
    loading: configDirectorReactContext.status === "loading",
  };
};

const useConfigDirectorContext = () => {
  const configDirectorReactContext = useContext(reactContext);
  if (!configDirectorReactContext?.client) {
    throw noContextError();
  }

  const updateContext = async (context: ConfigDirectorContext) => {
    await configDirectorReactContext.client?.updateContext(context);
  };

  return { updateContext };
};

const useConfigDirectorClient = () => {
  const configDirectorReactContext = useContext(reactContext);
  if (!configDirectorReactContext?.client) {
    throw noContextError();
  }

  return { client: configDirectorReactContext.client };
};

export { useConfigValue, useConfigDirectorContext, useConfigDirectorClient };
