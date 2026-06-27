export async function register() {
  const { register } = await import("@configdirector/nextjs-sdk/server");

  (globalThis as any).__serverHookCalls = { clientReady: 0, configsUpdated: 0 };

  await register({
    serverSdkKey: process.env["CONFIGDIRECTOR_SERVER_KEY"] ?? "",
    connection: { url: process.env.CONFIGDIRECTOR_BASE_URL },
    metadata: { appName: "test-app", appVersion: "1.2.3" },
    hooks: {
      clientReady: () => {
        (globalThis as any).__serverHookCalls.clientReady++;
      },
      configsUpdated: () => {
        (globalThis as any).__serverHookCalls.configsUpdated++;
      },
    },
  });
}
