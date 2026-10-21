import type { ConfigDirectorClient } from "@configdirector/server-sdk";

const CONTEXT_QUERY_KEYS = new Set(["id", "kind", "name", "anonymous"]);

// Query params double as the ConfigDirector context, e.g.
// GET /api/configs?id=user-123&name=Ada&anonymous=false&role=admin
export function contextFromQuery(searchParams: URLSearchParams) {
  const id = searchParams.get("id") ?? undefined;
  const kind = searchParams.get("kind") ?? undefined;
  const name = searchParams.get("name") ?? undefined;
  const anonymousParam = searchParams.get("anonymous");

  const traits: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (!CONTEXT_QUERY_KEYS.has(key)) {
      traits[key] = value;
    }
  }

  const context = {
    ...(id && { id }),
    ...(kind && { kind }),
    ...(name && { name }),
    ...(anonymousParam !== null && { anonymous: anonymousParam === "true" }),
    ...(Object.keys(traits).length > 0 && { traits }),
  };
  return Object.keys(context).length > 0 ? context : undefined;
}

export function resolveConfigs(client: ConfigDirectorClient, searchParams: URLSearchParams) {
  const context = contextFromQuery(searchParams);
  return {
    "temporary-feature-flag": client.getValue("temporary-feature-flag", true, context),
    "permanent-kill-switch": client.getValue("permanent-kill-switch", false, context),
    "integer-config": client.getValue("integer-config", 10, context),
    "day-of-the-week-config": client.getValue("day-of-the-week-config", "Friday", context),
    "json-value-config": client.getValue("json-value-config", {}, context),
  };
}
