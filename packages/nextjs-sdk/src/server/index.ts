export { register, getServerSingleton } from "./singleton";
export type { RegisterOptions } from "./singleton";

export { createSsrClient, SsrClient } from "./SsrClient";

export { createConsoleLogger } from "./logger";

export type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConfigValueType,
  ConfigDirectorMetaContext,
  ConnectionMode,
} from "@js-server-sdk/types";
