import type { ConfigDirectorClient, ClientEvents, HookHandler, ClientHooks } from "@js-server-sdk/types";
import { useNitroApp } from "nitropack/runtime";

export const useConfigDirectorServerHooks = (hooks: ClientHooks): void => {
  const client = useNitroApp().configDirectorClient as ConfigDirectorClient;

  if (!client) {
    throw new Error("The ConfigDirector Nitro plugin was not initialized");
  }

  const entries = Object.entries(hooks) as [keyof ClientHooks, ClientHooks[keyof ClientHooks]][];

  for (const [event, handler] of entries) {
    if (!handler) continue;
    const handlers = (Array.isArray(handler) ? handler : [handler]) as HookHandler<keyof ClientEvents>[];
    for (const h of handlers) {
      client.on(event, h);
    }
  }
};
