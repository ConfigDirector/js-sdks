export default defineNitroPlugin(() => {
  const calls = { clientReady: 0, configsUpdated: 0 };
  (globalThis as any).__serverHookCalls = calls;

  useConfigDirectorServerHooks({
    clientReady: () => { calls.clientReady++; },
    configsUpdated: () => { calls.configsUpdated++; },
  });
});
