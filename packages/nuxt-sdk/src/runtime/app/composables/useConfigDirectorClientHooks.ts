import { getCurrentInstance, onUnmounted } from "vue";
import { useNuxtApp } from "#app";
import type { ClientHooks, ClientEvents, HookHandler, ConfigDirectorClient } from "@js-client-core/types";

export const useConfigDirectorClientHooks = (hooks: ClientHooks): void => {
  const { $configDirectorClient } = useNuxtApp();
  const client = $configDirectorClient as ConfigDirectorClient;

  const hookEntries = Object.entries(hooks) as [keyof ClientEvents, ClientHooks[keyof ClientHooks]][];

  for (const [event, handler] of hookEntries) {
    if (!handler) continue;
    const handlers = (Array.isArray(handler) ? handler : [handler]) as HookHandler<keyof ClientEvents>[];
    for (const h of handlers) {
      client.on(event, h);
    }
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      for (const [event, handler] of hookEntries) {
        if (!handler) continue;
        const handlers = (Array.isArray(handler) ? handler : [handler]) as HookHandler<keyof ClientEvents>[];
        for (const h of handlers) {
          client.off(event, h);
        }
      }
    });
  }
};
