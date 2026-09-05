import type { HandlerDescriptor, SseConnection } from "./msw-setup";

declare module "vitest/internal/browser" {
  interface BrowserCommands {
    mswSetup: () => Promise<void>;
    mswTeardown: () => Promise<void>;
    mswUseHandlers: (...descriptors: HandlerDescriptor[]) => Promise<void>;
    mswUseSseHandler: (url: string, responses: SseConnection[], startDelay?: number) => Promise<void>;
    mswGetPayloads: () => Promise<unknown[]>;
    mswWasRequestReceived: () => Promise<boolean>;
  }
}
