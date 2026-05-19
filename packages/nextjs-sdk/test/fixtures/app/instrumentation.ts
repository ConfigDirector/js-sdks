export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register } = await import("@configdirector/nextjs-sdk/server");
    await register({
      serverSdkKey: process.env["CONFIGDIRECTOR_SERVER_KEY"] ?? "",
      connection: { url: process.env.CONFIGDIRECTOR_BASE_URL },
    });
  }
}
