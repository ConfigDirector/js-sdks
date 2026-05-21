import { getAppMeta } from "@configdirector/nextjs-sdk/server";

export async function GET() {
  return Response.json(getAppMeta());
}
