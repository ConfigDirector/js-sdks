export default defineNuxtPlugin(() => {
  useConfigDirectorClientHooks({
    clientReady: () => {
      if (typeof window !== "undefined") {
        (window as any).__hookCounts ??= { clientReady: 0, configsUpdated: 0 };
        (window as any).__hookCounts.clientReady++;
      }
    },
    configsUpdated: () => {
      if (typeof window !== "undefined") {
        (window as any).__hookCounts ??= { clientReady: 0, configsUpdated: 0 };
        (window as any).__hookCounts.configsUpdated++;
      }
    },
  });
});
