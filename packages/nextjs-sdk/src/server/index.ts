export { register, getServerSingleton } from "./singleton";
export type { RegisterOptions } from "./singleton";

export { generateSsrConfigSet } from "./ssr";
export type { GenerateSsrConfigSetOptions } from "./ssr";

export { ConfigDirectorProvider } from "./ConfigDirectorProvider";
export type { ConfigDirectorProviderProps } from "./ConfigDirectorProvider";

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
