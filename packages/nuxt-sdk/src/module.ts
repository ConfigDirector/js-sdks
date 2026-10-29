import {
  defineNuxtModule,
  addPlugin,
  createResolver,
  addImports,
  addServerPlugin,
  addServerHandler,
  addServerImports,
  useLogger,
} from "@nuxt/kit";
import type { LogLevel } from "consola";
import { defu } from "defu";
import type { ConnectionMode } from "@shared/types";
import type { OfflineValues } from "@js-server-sdk/types";
import { OFFLINE_VALUES_ROUTE } from "./runtime/offline-values-route";

export type { OfflineValue, OfflineValues } from "@js-server-sdk/types";
export type { ConfigEvaluation, EvaluationReason } from "@shared/types";

interface ConfigDirectorRuntimeConfig {
  /**
   * Your ConfigDirector Server SDK key. You can obtain this key from the ConfigDirector
   * dashboard under the project settings. Not needed when `connection.mode` is `offline`.
   *
   * This is a secret value and should not be committed to a source code repository. Alternatively,
   * it can be provided at runtime via the NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY environment variable.
   */
  serverSdkKey?: string;
  /**
   * Log level for the server side of the ConfigDirector Nuxt SDK, using consola's numeric levels.
   * 0 = error, 1 = warn, 2 = log, 3 = info, 4 = debug, 5 = trace.
   * This value overrides the module's logLevel and the global Nuxt/consola log level.
   */
  logLevel?: LogLevel;
  /**
   * Override the ConfigDirector server API base URL. Only update this if you are using a proxy
   * for ConfigDirector.
   * Can be set via the NUXT_CONFIGDIRECTOR_BASE_URL environment variable.
   */
  baseUrl?: string;
  /**
   * Connection options for the server SDK client used during SSR and in Nitro handlers.
   */
  connection?: {
    /**
     * The connection mode, one of `streaming` (default), `polling` or `offline`. In `streaming` mode
     * the connection stays open and receives config updates as they happen. In `polling` mode configs
     * are fetched once during initialization and then again on every `pollingInterval`. In `offline`
     * mode the server never connects to ConfigDirector and sends nothing: it serves the values of
     * `file` or `values` to every context, or the in-code default values when neither is given, and
     * needs no `serverSdkKey`. The browser follows the server into `offline` mode with the same values
     * unless `runtimeConfig.public.configdirector.connection` sets its own `mode` or `values`.
     * Can be set via the NUXT_CONFIGDIRECTOR_CONNECTION_MODE environment variable.
     */
    mode?: ConnectionMode;
    /**
     * The path of a JSON file holding the values to serve in `offline` mode, resolved against the
     * server process working directory. The file holds one object with a value per config key. A
     * file that is missing, unreadable, not a JSON object, or holding a value such as `null` makes
     * every request fail with a `ConfigDirectorInitializationError`. Only one of `file` and `values`
     * can be given, and only in `offline` mode.
     * Can be set via the NUXT_CONFIGDIRECTOR_CONNECTION_FILE environment variable.
     */
    file?: string;
    /**
     * The values to serve in `offline` mode, keyed by config key, as an alternative to `file`. The
     * config type of each value follows from the value: a boolean, an integral number (`integer`),
     * any other number (`float`), a string, or a plain object or array (`json`). Only one of `file`
     * and `values` can be given, and only in `offline` mode.
     */
    values?: OfflineValues;
    /**
     * The polling interval in seconds when `mode` is `polling`. Has no effect in the other modes.
     * When omitted (or `0`), the server SDK default is used.
     * Can be set via the NUXT_CONFIGDIRECTOR_CONNECTION_POLLING_INTERVAL environment variable.
     */
    pollingInterval?: number;
    /**
     * How long, in milliseconds, the server SDK client waits for its initial config payload. Requests
     * that arrive before the payload is received are held until it arrives or this timeout elapses,
     * after which they render with default values. When omitted (or `0`), the server SDK default is used.
     * Can be set via the NUXT_CONFIGDIRECTOR_CONNECTION_TIMEOUT environment variable.
     */
    timeout?: number;
  };
  /**
   * Whether requests that arrive before the server SDK client received its initial config payload
   * (for example right after the server starts) wait for it, for up to the connection `timeout`, before
   * being handled. When disabled, such requests are handled immediately and evaluate configs to their
   * default values until the payload arrives.
   *
   * Defaults to `true`. Can be set via the NUXT_CONFIGDIRECTOR_WAIT_FOR_INITIALIZATION environment variable.
   */
  waitForInitialization?: boolean;
}

interface ConfigDirectorPublicRuntimeConfig {
  /**
   * Your ConfigDirector Client SDK key. You can obtain this key from the ConfigDirector
   * dashboard under the project settings. Not needed when the browser runs in `offline` mode,
   * whether given here or inherited from the server.
   *
   * This value is not a secret. It can alternatively be provided at runtime via the
   * NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY environment variable.
   */
  clientSdkKey?: string;
  /**
   * Your app's name. Both the browser and the server send it, so ConfigDirector targeting rules can use it.
   */
  appName?: string;
  /**
   * Your app's version. Both the browser and the server send it, so ConfigDirector targeting rules can
   * use it.
   *
   * This can be a semver value or an arbitrary string (like a commit hash).
   */
  appVersion?: string;
  /**
   * Log level for the client/browser side of the ConfigDirector Nuxt SDK, using consola's numeric levels.
   * 0 = error, 1 = warn, 2 = log, 3 = info, 4 = debug, 5 = trace.
   * This value overrides the module's logLevel and the global Nuxt/consola log level.
   */
  logLevel?: LogLevel;
  /**
   * Override the ConfigDirector client API base URL. Primarily useful for testing.
   * When omitted, the default ConfigDirector client endpoint is used.
   * Can be set via the NUXT_PUBLIC_CONFIGDIRECTOR_BASE_URL environment variable.
   */
  baseUrl?: string;
  /**
   * Connection options for the browser client used on the client side. When neither `mode` nor
   * `values` is given and the server runs in `offline` mode, the browser runs in `offline` mode
   * too, with the server's values.
   */
  connection?: {
    /**
     * The connection mode, one of `streaming`, `polling` or `offline`. In `streaming` mode the
     * connection stays open and receives config updates as they happen. In `polling` mode configs
     * are fetched once during initialization and then again on every `pollingInterval`. In `offline`
     * mode the browser never connects to ConfigDirector and sends nothing: it serves `values` to
     * every context, or the in-code default values when none are given, and needs no `clientSdkKey`.
     * Empty when not set; the browser client then uses its default, `streaming`, unless it follows
     * an offline server.
     * Can be set via the NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE environment variable.
     */
    mode?: ConnectionMode | "";
    /**
     * The values to serve in `offline` mode, keyed by config key. The config type of each value
     * follows from the value: a boolean, an integral number (`integer`), any other number (`float`),
     * a string, or a plain object or array (`json`). Can be given only in `offline` mode.
     */
    values?: OfflineValues;
    /**
     * The polling interval in seconds when `mode` is `polling`. Has no effect in the other modes.
     * When omitted (or `0`), it defaults to 60 seconds. A value below the minimum of 30 seconds is
     * raised to 30 seconds and a warning is logged.
     * Can be set via the NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_POLLING_INTERVAL environment variable.
     */
    pollingInterval?: number;
    /**
     * How long, in milliseconds, the browser client waits for its initial config payload during
     * initialization before the app renders with default values. When omitted (or `0`), it defaults
     * to 2000 milliseconds.
     * Can be set via the NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_TIMEOUT environment variable.
     */
    timeout?: number;
  };
  /**
   * Whether the browser client waits for its first context before it connects. With it on, the client
   * opens no connection and `useConfigDirectorStatus` reports `loading` until the app calls
   * `updateContext` from `useConfigDirectorContext`; that first call starts the client with the context
   * it was given. A context set during server-side rendering starts the client when the app is created,
   * as with the option off. Turn it on when the app knows its context only after startup, such as with
   * `ssr: false` or a context fetched in the browser, so the first connection carries the context
   * instead of a connection with no context, whose visitor counts as a monthly active user on its own.
   * It has no effect in `offline` mode, where the client is ready at once.
   *
   * Defaults to `false`. Can be set via the NUXT_PUBLIC_CONFIGDIRECTOR_DEFER_INITIALIZATION environment variable.
   */
  deferInitialization?: boolean;
  /**
   * The connection mode the server runs in, written by the module on every request so the browser
   * knows whether to follow the server into `offline` mode. Not an option: any value set here is
   * overwritten on every request.
   */
  serverConnectionMode?: ConnectionMode;
}

declare module "nuxt/schema" {
  interface RuntimeConfig {
    configdirector: ConfigDirectorRuntimeConfig;
  }
  interface PublicRuntimeConfig {
    configdirector: ConfigDirectorPublicRuntimeConfig;
  }
}

declare module "@nuxt/schema" {
  interface RuntimeConfig {
    configdirector: ConfigDirectorRuntimeConfig;
  }
  interface PublicRuntimeConfig {
    configdirector: ConfigDirectorPublicRuntimeConfig;
  }
}

export interface ModuleOptions {
  /**
   * Log level for the ConfigDirector SDK, using consola's numeric levels.
   * 0 = error, 1 = warn, 2 = log, 3 = info, 4 = debug, 5 = trace.
   * When omitted, the SDK inherits the global Nuxt/consola log level.
   */
  logLevel?: LogLevel;
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "@configdirector/nuxt-sdk",
    configKey: "configdirector",
    compatibility: {
      nuxt: ">=3.7.0",
    },
  },
  defaults: {},
  setup(options, nuxt) {
    const logger = useLogger("configdirector");
    const resolver = createResolver(import.meta.url);

    const serverDefaults: ConfigDirectorRuntimeConfig = {
      serverSdkKey: "",
      baseUrl: "",
      connection: { mode: "streaming", file: "", pollingInterval: 0, timeout: 0 },
      waitForInitialization: true,
    };
    nuxt.options.runtimeConfig.configdirector = defu(
      nuxt.options.runtimeConfig.configdirector,
      options.logLevel !== undefined ? { ...serverDefaults, logLevel: options.logLevel } : serverDefaults,
    );
    const publicDefaults: ConfigDirectorPublicRuntimeConfig = {
      clientSdkKey: "",
      baseUrl: "",
      connection: { mode: "", pollingInterval: 0, timeout: 0 },
      deferInitialization: false,
    };
    nuxt.options.runtimeConfig.public.configdirector = defu(
      nuxt.options.runtimeConfig.public.configdirector,
      options.logLevel !== undefined ? { ...publicDefaults, logLevel: options.logLevel } : publicDefaults,
    );

    logger.debug("ConfigDirector Nuxt module setup complete");

    addServerPlugin(resolver.resolve("./runtime/nitro/plugin"));
    addServerHandler({
      middleware: true,
      handler: resolver.resolve("./runtime/nitro/middleware"),
    });
    addServerHandler({
      route: OFFLINE_VALUES_ROUTE,
      method: "get",
      handler: resolver.resolve("./runtime/nitro/offline-values"),
    });
    addServerImports([
      {
        name: "useConfigDirectorServerClient",
        as: "useConfigDirectorServerClient",
        from: resolver.resolve("./runtime/server/composables/useConfigDirectorServerClient"),
      },
      {
        name: "useConfigDirectorServerHooks",
        as: "useConfigDirectorServerHooks",
        from: resolver.resolve("./runtime/server/composables/useConfigDirectorServerHooks"),
      },
    ]);

    addPlugin(resolver.resolve("./runtime/plugin.server"));
    addPlugin(resolver.resolve("./runtime/plugin.client"));
    addImports([
      {
        name: "useConfigDirectorClient",
        as: "useConfigDirectorClient",
        from: resolver.resolve("./runtime/app/composables/useConfigDirectorClient"),
      },
      {
        name: "useConfigDirectorStatus",
        as: "useConfigDirectorStatus",
        from: resolver.resolve("./runtime/app/composables/useConfigDirectorStatus"),
      },
      {
        name: "useConfigDirectorContext",
        as: "useConfigDirectorContext",
        from: resolver.resolve("./runtime/app/composables/useConfigDirectorContext"),
      },
      {
        name: "useConfigDirectorValue",
        as: "useConfigDirectorValue",
        from: resolver.resolve("./runtime/app/composables/useConfigDirectorValue"),
      },
      {
        name: "useConfigDirectorClientHooks",
        as: "useConfigDirectorClientHooks",
        from: resolver.resolve("./runtime/app/composables/useConfigDirectorClientHooks"),
      },
    ]);
  },
});
