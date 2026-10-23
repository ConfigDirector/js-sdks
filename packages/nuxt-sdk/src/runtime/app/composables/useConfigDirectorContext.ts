import type { ConfigDirectorContext } from "@js-client-core/types";
import { useState, useNuxtApp } from "#app";
import { toRaw, readonly } from "vue";
import type { Ref } from "vue";
import { useConfigDirectorClient } from "./useConfigDirectorClient";
import { admittedContextOrNone } from "@shared/context-kind";
import { decideContextUpdateAction } from "../../client-startup";
import type { ClientStartup } from "../../client-startup";

const DEFAULT_TIMEOUT = 3_000;

const getEffectiveTimeout = (option?: number) => {
  return option && option > 0 ? option : DEFAULT_TIMEOUT;
};

export const useConfigDirectorContext = (): {
  context: Readonly<Ref<ConfigDirectorContext | undefined>>;
  updateContext: (context: ConfigDirectorContext, options?: { timeoutMilliseconds: number }) => Promise<void>;
} => {
  const state = useState<ConfigDirectorContext | undefined>("configdirector-context");
  const { client } = useConfigDirectorClient();
  const { $configDirectorClientStartup } = useNuxtApp();
  const startup = $configDirectorClientStartup as ClientStartup;

  const handContextToClient = (rawContext: ConfigDirectorContext): Promise<void> => {
    const contextUpdateAction = decideContextUpdateAction(client, rawContext, startup.waitsForFirstContext);
    switch (contextUpdateAction) {
      case "startClient":
        return startup.start(rawContext);
      case "updateContext":
        return client.updateContext(rawContext);
    }
  };

  const updateContext = async (context: ConfigDirectorContext, options?: { timeoutMilliseconds: number }) => {
    const rawContext = toRaw(context);
    const oldContext = JSON.stringify(state.value);
    const newContext = JSON.stringify(rawContext);
    state.value = admittedContextOrNone(rawContext);
    if (oldContext != newContext) {
      const timeout = getEffectiveTimeout(options?.timeoutMilliseconds);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          handContextToClient(rawContext),
          new Promise<void>((resolve) => {
            timer = setTimeout(() => resolve(), timeout);
          }),
        ]);
      }
      finally {
        clearTimeout(timer);
      }
    }
  };

  return {
    context: readonly(state),
    updateContext,
  };
};
