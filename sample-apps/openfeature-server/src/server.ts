import { createServer } from "node:http";
import type { EvaluationContext } from "@openfeature/server-sdk";
import { OpenFeature } from "@openfeature/server-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-server-provider";

const serverSdkKey = process.env["CONFIGDIRECTOR_SERVER_KEY"] ?? "";
const port = Number(process.env["PORT"] ?? 3600);

await OpenFeature.setProviderAndWait(new ConfigDirectorProvider(serverSdkKey));
const client = OpenFeature.getClient();

async function resolveConfigs(context: EvaluationContext) {
  return {
    "temporary-feature-flag": await client.getBooleanValue("temporary-feature-flag", true, context),
    "permanent-kill-switch": await client.getBooleanValue("permanent-kill-switch", false, context),
    "integer-config": await client.getNumberValue("integer-config", 10, context),
    "day-of-the-week-config": await client.getStringValue("day-of-the-week-config", "Friday", context),
    "json-value-config": await client.getObjectValue("json-value-config", {}, context),
  };
}

const CONTEXT_QUERY_KEYS = new Set(["targetingKey", "id", "name", "anonymous"]);

// Query params double as the OpenFeature evaluation context, e.g.
// GET /configs?targetingKey=user-123&name=Ada&anonymous=false&role=admin
function contextFromQuery(searchParams: URLSearchParams): EvaluationContext {
  const targetingKey = searchParams.get("targetingKey") ?? searchParams.get("id") ?? undefined;
  const name = searchParams.get("name") ?? undefined;
  const anonymousParam = searchParams.get("anonymous");

  const traits: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (!CONTEXT_QUERY_KEYS.has(key)) {
      traits[key] = value;
    }
  }

  return {
    ...(targetingKey && { targetingKey }),
    ...(name && { name }),
    ...(anonymousParam !== null && { anonymous: anonymousParam === "true" }),
    ...(Object.keys(traits).length > 0 && { traits }),
  };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method !== "GET" || url.pathname !== "/configs") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. Try GET /configs" }));
    return;
  }

  resolveConfigs(contextFromQuery(url.searchParams))
    .then((state) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(state, null, 2));
    })
    .catch((error: unknown) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    });
});

server.listen(port, () => {
  console.log(`ConfigDirector OpenFeature server sample listening on http://localhost:${port}/configs`);
});
