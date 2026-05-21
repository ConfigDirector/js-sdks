export async function register() {
  const { register } = await import("@configdirector/nextjs-sdk/server");
  await register({
    serverSdkKey: process.env["CONFIGDIRECTOR_SERVER_KEY"] ?? "",
    connection: { url: process.env.CONFIGDIRECTOR_BASE_URL },
    metadata: { appName: "test-app", appVersion: "1.2.3" },
  });
}
