import { getConfigClient } from "@configdirector/nextjs-sdk/server";

export async function GET() {
  const client = getConfigClient();
  const value = client.getValue("server-api-value", "DEFAULT VALUE");
  return Response.json({ "server-api-value": value });
}
