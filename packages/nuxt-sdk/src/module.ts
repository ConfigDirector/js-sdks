import {
  defineNuxtModule,
  addPlugin,
  createResolver,
  addImports,
  addServerPlugin,
  addServerHandler,
  useLogger,
} from "@nuxt/kit";
import type { LogLevel } from "consola";
import { defu } from "defu";

declare module "nuxt/schema" {
  interface RuntimeConfig {
    configdirector: {
      serverSdkKey: string;
      logLevel?: number;
    };
  }
  interface PublicRuntimeConfig {
    configdirector: {
      clientSdkKey: string;
      appName: string;
      appVersion: string;
      logLevel?: number;
    };
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
      nuxt: ">=4.0.0",
    },
  },
  defaults: {},
  setup(options, nuxt) {
    const logger = useLogger("configdirector");
    const resolver = createResolver(import.meta.url);

    if (options.logLevel !== undefined) {
      nuxt.options.runtimeConfig.configdirector = defu(
        { logLevel: options.logLevel },
        nuxt.options.runtimeConfig.configdirector,
      );
      nuxt.options.runtimeConfig.public.configdirector = defu(
        { logLevel: options.logLevel },
        nuxt.options.runtimeConfig.public.configdirector,
      );
    }

    logger.debug("ConfigDirector Nuxt module setup complete");

    addServerPlugin(resolver.resolve("./runtime/nitro/plugin"));
    addServerHandler({ middleware: true, handler: resolver.resolve("./runtime/nitro/middleware") });
    addPlugin(resolver.resolve("./runtime/plugin.server"));
    addPlugin(resolver.resolve("./runtime/plugin.client"));
    addImports({
      name: "useClient",
      as: "useClient",
      from: resolver.resolve("./runtime/app/composables/useClient"),
    });
    addImports({
      name: "useClientStatus",
      as: "useClientStatus",
      from: resolver.resolve("./runtime/app/composables/useClientStatus"),
    });
    addImports({
      name: "useContext",
      as: "useContext",
      from: resolver.resolve("./runtime/app/composables/useContext"),
    });
    addImports({
      name: "useConfigValue",
      as: "useConfigValue",
      from: resolver.resolve("./runtime/app/composables/useConfigValue"),
    });
  },
});
