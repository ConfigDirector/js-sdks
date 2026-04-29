import { startMockSseServer } from "./helpers/mock-sse-server";

export async function setup() {
  const mockServer = await startMockSseServer();

  // These env vars are picked up by Nuxt's runtime config env var auto-mapping:
  //   NUXT_CONFIGDIRECTOR_BASE_URL  → runtimeConfig.configdirector.baseUrl (server SDK)
  //   NUXT_PUBLIC_CONFIGDIRECTOR_BASE_URL → runtimeConfig.public.configdirector.baseUrl (browser SDK)
  process.env.NUXT_CONFIGDIRECTOR_BASE_URL = mockServer.baseUrl;
  process.env.NUXT_PUBLIC_CONFIGDIRECTOR_BASE_URL = mockServer.baseUrl;

  // SDK keys — the module requires non-empty values
  process.env.NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY = "test-server-sdk-key";
  process.env.NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY = "test-client-sdk-key";

  return async () => {
    await mockServer.close();
  };
}
