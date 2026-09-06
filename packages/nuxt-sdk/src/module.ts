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

interface ConfigDirectorRuntimeConfig {
  /**
   * Your ConfigDirector Server SDK key. You can obtain this key from the ConfigDirector
   * dashboard under the project settings.
   *
   * This is a secret value and should not be committed to a source code repository. Alternatively,
   * it can be provided at runtime via the NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY environment variable.
   */
  serverSdkKey: string;
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
     * The connection mode, one of `streaming` (default) or `polling`. In `streaming` mode the
     * connection stays open and receives config updates as they happen. In `polling` mode configs
     * are fetched once during initialization and then again on every `pollingInterval`.
     * Can be set via the NUXT_CONFIGDIRECTOR_CONNECTION_MODE environment variable.
     */
    mode?: ConnectionMode;
    /**
     * The polling interval in seconds when `mode` is `polling`. Has no effect in `streaming` mode.
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
   * dashboard under the project settings.
   *
   * This value is not a secret. It can alternatively be provided at runtime via the
   * NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY environment variable.
   */
  clientSdkKey: string;
  /**
   * Your app's name. This value can be used in ConfigDirector targeting rules.
   */
  appName?: string;
  /**
   * Your app's version. This value can be used in ConfigDirector targeting rules.
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
      connection: { mode: "streaming", pollingInterval: 0, timeout: 0 },
      waitForInitialization: true,
    };
    nuxt.options.runtimeConfig.configdirector = defu(
      nuxt.options.runtimeConfig.configdirector,
      options.logLevel !== undefined ? { ...serverDefaults, logLevel: options.logLevel } : serverDefaults,
    );
    nuxt.options.runtimeConfig.public.configdirector = defu(
      nuxt.options.runtimeConfig.public.configdirector,
      options.logLevel !== undefined
        ? { clientSdkKey: "", logLevel: options.logLevel, baseUrl: "" }
        : { clientSdkKey: "", baseUrl: "" },
    );

    logger.debug("ConfigDirector Nuxt module setup complete");

    addServerPlugin(resolver.resolve("./runtime/nitro/plugin"));
    addServerHandler({
      middleware: true,
      handler: resolver.resolve("./runtime/nitro/middleware"),
    });
    addServerImports([
      {
        name: "useConfigDirectorClient",
        as: "useConfigDirectorClient",
        from: resolver.resolve("./runtime/server/composables/useConfigDirectorClient"),
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
