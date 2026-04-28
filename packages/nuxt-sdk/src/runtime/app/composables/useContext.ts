import type { ConfigDirectorContext } from "@js-client-core/types";
import { useState } from "#app";
import { toRaw } from "vue";
import { useClient } from "./useClient";

const DEFAULT_TIMEOUT = 3_000;

const getEffectiveTimeout = (option?: number) => {
  return option && option > 0 ? option : DEFAULT_TIMEOUT;
};

export const useContext = (): {
  context: ConfigDirectorContext | undefined;
  updateContext: (context: ConfigDirectorContext, options?: { timeoutMilliseconds: number }) => Promise<void>;
} => {
  const state = useState<ConfigDirectorContext | undefined>("configdirector-context");
  const { client } = useClient();

  const updateContext = async (context: ConfigDirectorContext, options?: { timeoutMilliseconds: number }) => {
    const rawContext = toRaw(context);
    const oldContext = JSON.stringify(state.value);
    const newContext = JSON.stringify(rawContext);
    state.value = rawContext;
    if (oldContext != newContext) {
      const timeout = getEffectiveTimeout(options?.timeoutMilliseconds);
      await Promise.race([
        client.updateContext(rawContext),
        new Promise<void>((resolve) => {
          setTimeout(() => resolve(), timeout);
        }),
      ]);
    }
  };

  return {
    context: state.value,
    updateContext,
  };
};
