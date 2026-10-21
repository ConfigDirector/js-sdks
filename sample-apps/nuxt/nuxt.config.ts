export default defineNuxtConfig({
  compatibilityDate: "2026-10-01",
  modules: ["@configdirector/nuxt-sdk", "@nuxt/test-utils/module"],
  css: ["~/assets/css/main.css"],
  app: {
    head: { title: "ConfigDirector Nuxt Sample" },
  },
  // Both keys are read at request time from NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY and
  // NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY (see .env.example), so one build can serve every
  // environment. The server key stays on the Nitro server; only the public client key reaches the
  // browser.
  runtimeConfig: {
    configdirector: { serverSdkKey: "" },
    public: { configdirector: { clientSdkKey: "" } },
  },
  // Type-checks the server tests with the server code they test (test/nuxt is in the app's tsconfig).
  nitro: {
    typescript: { tsConfig: { include: ["../test/server/**/*"] } },
  },
});
