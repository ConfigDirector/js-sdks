export default defineEventHandler(() => {
  const client = useConfigDirectorClient();
  return {
    welcomeMessage: client.getValue("welcome-message", "default-message"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
    jsonData: client.getValue("json-data", { label: "default" }),
    jsonDataRaw: client.getValue("json-data-raw", "{}"),
    jsonDataFallback: client.getValue("non-existent-json", { label: "default" }),
    nonExistentKey: client.getValue("non-existent-key", "default-value"),
    isReady: client.isReady,
  };
});
