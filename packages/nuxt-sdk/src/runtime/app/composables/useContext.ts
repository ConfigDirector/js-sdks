import type { ConfigDirectorContext } from "@js-client-core/types";
import { useState } from "#app";
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
    const oldContext = JSON.stringify(state.value);
    const newContext = JSON.stringify(context);
    state.value = context;
    if (oldContext != newContext) {
      const timeout = getEffectiveTimeout(options?.timeoutMilliseconds);
      console.info(`[@configdirector/nuxt-sdk] Updating context, timeout is ${timeout}ms`);
      await Promise.race([
        client.updateContext(context),
        new Promise<void>((resolve) => {
          setTimeout(() => resolve(), timeout);
        }),
      ]);
      console.info(`[@configdirector/nuxt-sdk] Updated context, ready status is ${client.isReady}`);
    }
  };

  return {
    context: state.value,
    updateContext,
  };
};
