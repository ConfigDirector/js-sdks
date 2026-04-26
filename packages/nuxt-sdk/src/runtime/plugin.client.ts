import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createBrowserClient } from "@js-browser-client/index";
import { useContext } from "./app/composables/useContext";

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();

  console.log("ConfigDirector plugin is in browser");

  const client = createBrowserClient(
    runtimeConfig.public.configdirector.clientSdkKey,
    { sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" },
    {
      metadata: {
        appName: runtimeConfig.public.configdirector.appName,
        appVersion: runtimeConfig.public.configdirector.appVersion,
      },
      connection: {
        timeout: 2_000,
      },
    },
  );

  nuxtApp.hooks.hook("app:created", async () => {
    console.info(`[@configdirector/nuxt-sdk] Initializing browser client`);
    const { context } = useContext();
    await client.initialize(context);
    console.info(
      `[@configdirector/nuxt-sdk] Browser initialization awaited, ready status: ${client.isReady}`,
    );
  });

  return {
    provide: {
      configDirectorClient: client,
    },
  };
});
