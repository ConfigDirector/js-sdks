export async function GET() {
  const calls = (globalThis as any).__serverHookCalls ?? { clientReady: 0, configsUpdated: 0 };
  return Response.json(calls);
}
