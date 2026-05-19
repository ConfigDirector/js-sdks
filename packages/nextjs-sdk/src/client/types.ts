import type { ConfigDirectorClient, ConfigDirectorContext, ConfigDirectorLogger } from "@js-browser-client/index";

export type ClientStatus = "loading" | "ready" | "default";

export interface ConfigDirectorContextData {
  client?: ConfigDirectorClient;
  updatedAt?: Date;
  status: ClientStatus;
  initialConfigs?: Record<string, unknown>;
}

export type ConfigDirectorProviderState = Omit<ConfigDirectorContextData, "initialConfigs">;

export type ConfigDirectorProviderOptions = {
  /**
   * Your ConfigDirector Client SDK key. This is a public value safe for the browser.
   */
  sdkKey: string;
  appName?: string;
  appVersion?: string;
  /**
   * Override the ConfigDirector client API base URL. Primarily useful for testing or proxying.
   */
  url?: string;
  /**
   * Initialization timeout in milliseconds. Defaults to 3000.
   */
  timeout?: number;
  /**
   * Initial user context to evaluate targeting rules against.
   */
  context?: ConfigDirectorContext;
  /**
   * A logger instance created with {@link createConsoleLogger}.
   */
  logger?: ConfigDirectorLogger;
  /**
   * Pre-evaluated config values from the server, used to hydrate client components correctly
   * during SSR. Obtain these by calling {@link createSsrClient} in your Server Component
   * layout and passing the results here.
   *
   * When the browser client is not yet ready (during SSR and the initial client render before
   * initialization completes), hooks will return values from this map rather than the default
   * value, avoiding a flash of wrong content on hydration.
   */
  initialConfigs?: Record<string, unknown>;
};
