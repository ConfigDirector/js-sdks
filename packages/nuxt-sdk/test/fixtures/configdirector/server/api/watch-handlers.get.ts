export default defineEventHandler(() => {
  const client = useConfigDirectorClient();
  const handlersMap = (client as any).handlersMap as Map<string, unknown[]>;
  let count = 0;
  for (const handlers of handlersMap.values()) {
    count += handlers.length;
  }
  return { count };
});
