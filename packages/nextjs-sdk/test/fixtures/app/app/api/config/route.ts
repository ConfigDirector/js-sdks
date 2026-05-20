import { getServerSingleton } from "@configdirector/nextjs-sdk/server";

export async function GET() {
  const client = getServerSingleton();
  return Response.json({
    welcomeMessage: client.getValue("welcome-message", "default-message"),
    featureEnabled: client.getValue("feature-enabled", false),
    itemCount: client.getValue("item-count", 0),
    nonExistentKey: client.getValue("non-existent-key", "default-value"),
    isReady: client.isReady,
  });
}
