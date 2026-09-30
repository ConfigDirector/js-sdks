import type { ClientEvents, ClientHooks, ConfigDirectorClient } from "./types";

type Registration = { event: keyof ClientEvents; handler: (payload: any) => void };

export class ClientHandlers {
  private registrations: Registration[] = [];

  constructor(private readonly client: ConfigDirectorClient) {}

  public on<T extends keyof ClientEvents>(event: T, handler: (payload: ClientEvents[T]) => void) {
    this.client.on(event, handler);
    this.registrations.push({ event, handler });
  }

  public registerHooks(hooks: ClientHooks | undefined) {
    for (const [event, handlerOrHandlers] of Object.entries(hooks ?? {})) {
      const handlers = Array.isArray(handlerOrHandlers) ? handlerOrHandlers : [handlerOrHandlers];
      for (const handler of handlers) {
        if (typeof handler === "function") {
          this.on(event as keyof ClientEvents, handler as (payload: unknown) => void);
        }
      }
    }
  }

  public removeAll() {
    for (const { event, handler } of this.registrations) {
      this.client.off(event, handler);
    }
    this.registrations = [];
  }
}
