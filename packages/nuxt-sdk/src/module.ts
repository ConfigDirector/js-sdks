import {
  defineNuxtModule,
  addPlugin,
  createResolver,
  addImports,
  addServerPlugin,
  addServerHandler,
} from "@nuxt/kit";
import type { ConfigDirectorLoggingLevel } from "@shared/types";

declare module "nuxt/schema" {
  interface RuntimeConfig {
    configdirector: {
      serverSdkKey: string;
      logLevel?: ConfigDirectorLoggingLevel;
    };
  }
  interface PublicRuntimeConfig {
    configdirector: {
      clientSdkKey: string;
      appName: string;
      appVersion: string;
      logLevel?: ConfigDirectorLoggingLevel;
    };
  }
}

// Module options TypeScript interface definition
export interface ModuleOptions {}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "@configdirector/nuxt-sdk",
    configKey: "configdirector",
    compatibility: {
      nuxt: ">=4.0.0",
    },
  },
  // Default configuration options of the Nuxt module
  defaults: {},
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url);

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
