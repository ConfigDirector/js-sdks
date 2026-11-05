export { register, getConfigClient, getAppMeta } from "./singleton";
export type { RegisterOptions } from "./singleton";

export { generateSsrConfigSet } from "./ssr";
export type { GenerateSsrConfigSetOptions } from "./ssr";

export { ConfigDirectorProvider } from "./ConfigDirectorProvider";
export type { ConfigDirectorProviderProps } from "./ConfigDirectorProvider";

export { createConsoleLogger } from "./logger";
export { ConfigDirectorInitializationError } from "@shared/errors";

export type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConfigEvaluation,
  ConfigValueType,
  ConfigDirectorMetaContext,
  ConnectionMode,
  EvaluationReason,
  OfflineClientOptions,
  OfflineValue,
  OfflineValues,
  Variation,
} from "@js-server-sdk/types";
