import type { HandlerDescriptor, SseMessage } from "./msw-setup";

declare module "vitest/internal/browser" {
  interface BrowserCommands {
    mswSetup: () => Promise<void>;
    mswTeardown: () => Promise<void>;
    mswUseHandlers: (...descriptors: HandlerDescriptor[]) => Promise<void>;
    mswUseSseHandler: (url: string, responses: SseMessage[][], startDelay?: number) => Promise<void>;
    mswGetPayloads: () => Promise<unknown[]>;
    mswWasRequestReceived: () => Promise<boolean>;
  }
}
