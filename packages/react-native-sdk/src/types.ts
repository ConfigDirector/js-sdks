import type {
  ClientHooks,
  ConfigDirectorClient,
  ConfigDirectorContext,
  ConfigDirectorLogger,
} from "@js-client-core/index";

export type ClientStatus = "loading" | "ready" | "default";

export interface ConfigDirectorContextData {
  client?: ConfigDirectorClient;
  updatedAt?: Date;
  status: ClientStatus;
}

export type ConfigDirectorProviderState = ConfigDirectorContextData;

/** Minimal connectivity state shape consumed from @react-native-community/netinfo */
export type NetInfoState = { isConnected: boolean | null };

/**
 * A subscription function with the same signature as `NetInfo.addEventListener` from
 * `@react-native-community/netinfo`. Pass this prop to enable immediate reconnection
 * when the device regains network connectivity instead of waiting for the next
 * exponential-backoff retry.
 *
 * @example
 * import NetInfo from '@react-native-community/netinfo';
 * <ConfigDirectorProvider netInfoSubscribe={NetInfo.addEventListener} ... />
 */
export type NetInfoSubscribe = (callback: (state: NetInfoState) => void) => () => void;

export type ConfigDirectorProviderOptions = {
  sdkKey: string;
  appName?: string;
  appVersion?: string;
  url?: string;
  timeout?: number;
  context?: ConfigDirectorContext;
  logger?: ConfigDirectorLogger;
  hooks?: ClientHooks;
  netInfoSubscribe?: NetInfoSubscribe;
};
