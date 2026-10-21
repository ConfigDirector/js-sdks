import type { ClientEvents, HookHandler, ClientHooks } from "@js-server-sdk/types";
import { useConfigDirectorServerClient } from "./useConfigDirectorServerClient";

export const useConfigDirectorServerHooks = (hooks: ClientHooks): void => {
  const client = useConfigDirectorServerClient();

  const entries = Object.entries(hooks) as [keyof ClientHooks, ClientHooks[keyof ClientHooks]][];

  for (const [event, handler] of entries) {
    if (!handler) continue;
    const handlers = (Array.isArray(handler) ? handler : [handler]) as HookHandler<keyof ClientEvents>[];
    for (const h of handlers) {
      client.on(event, h);
    }
  }
};
