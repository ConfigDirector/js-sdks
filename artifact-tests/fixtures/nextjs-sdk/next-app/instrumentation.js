export async function register() {
  const { register } = await import("@configdirector/nextjs-sdk/server");
  await register({ connection: { mode: "offline", values: { "welcome-message": "Hello offline" } } });
}
