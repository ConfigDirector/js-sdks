export default defineEventHandler(() => {
  return (globalThis as any).__serverHookCalls ?? { clientReady: 0, configsUpdated: 0 };
});
