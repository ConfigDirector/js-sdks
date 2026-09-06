import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import type { AddressInfo } from "node:net";

const ENVIRONMENT_ID = "10000000-0000-0000-0000-000000000000";
const PROJECT_ID = "20000000-0000-0000-0000-000000000000";

const SERVER_BUNDLE = {
  environmentId: ENVIRONMENT_ID,
  projectId: PROJECT_ID,
  kind: "full",
  configs: {
    "welcome-message": {
      id: "00000000-0000-0000-0000-000000000001",
      key: "welcome-message",
      type: "string",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: "Hello from ConfigDirector!",
      },
    },
    "feature-enabled": {
      id: "00000000-0000-0000-0000-000000000002",
      key: "feature-enabled",
      type: "boolean",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: "true",
      },
    },
    "item-count": {
      id: "00000000-0000-0000-0000-000000000003",
      key: "item-count",
      type: "integer",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: "7",
      },
    },
    "json-data": {
      id: "00000000-0000-0000-0000-000000000004",
      key: "json-data",
      type: "json",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: JSON.stringify({ greeting: "hello", count: 3 }),
      },
    },
    "json-data-raw": {
      id: "00000000-0000-0000-0000-000000000005",
      key: "json-data-raw",
      type: "json",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: JSON.stringify({ greeting: "hello" }),
      },
    },
  },
};

export const CLIENT_BUNDLE = {
  environmentId: ENVIRONMENT_ID,
  projectId: PROJECT_ID,
  kind: "full",
  configs: {
    "welcome-message": {
      id: "00000000-0000-0000-0000-000000000001",
      key: "welcome-message",
      type: "string",
      value: "Hello from ConfigDirector!",
    },
    "feature-enabled": {
      id: "00000000-0000-0000-0000-000000000002",
      key: "feature-enabled",
      type: "boolean",
      value: "true",
    },
    "item-count": {
      id: "00000000-0000-0000-0000-000000000003",
      key: "item-count",
      type: "integer",
      value: "7",
    },
  },
};

export const HELD_SERVER_SDK_KEY = "test-server-sdk-key-held";
const RELEASE_HELD_BUNDLES_PATH = "/__control/release-held-bundles";

const sseEvent = (bundle: object): string =>
  `data: ${JSON.stringify(bundle)}\n\n`;

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
};

const handlePreflight = (_req: IncomingMessage, res: ServerResponse): void => {
  res.writeHead(204, CORS_HEADERS);
  res.end();
};

const openSseStream = (res: ServerResponse): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    ...CORS_HEADERS,
  });
};

const handleClientSseRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  await readBody(req);
  openSseStream(res);
  res.write(sseEvent(CLIENT_BUNDLE));
};

const handleServerSseRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  heldStreams: Set<ServerResponse>,
): Promise<void> => {
  const { serverSdkKey } = JSON.parse(await readBody(req)) as { serverSdkKey?: string };
  openSseStream(res);
  if (serverSdkKey === HELD_SERVER_SDK_KEY) {
    heldStreams.add(res);
    res.on("close", () => heldStreams.delete(res));
    return;
  }
  res.write(sseEvent(SERVER_BUNDLE));
};

const releaseHeldStreams = (
  heldStreams: Set<ServerResponse>,
  res: ServerResponse,
): void => {
  for (const heldStream of heldStreams) {
    heldStream.write(sseEvent(SERVER_BUNDLE));
  }
  heldStreams.clear();
  res.writeHead(204);
  res.end();
};

const handleTelemetryRequest = (
  req: IncomingMessage,
  res: ServerResponse,
): void => {
  req.resume();
  req.on("end", () => {
    res.writeHead(202, CORS_HEADERS);
    res.end();
  });
};

export interface MockSseServer {
  port: number;
  baseUrl: string;
  close(): Promise<void>;
}

export const releaseHeldServerBundles = async (mockServerBaseUrl: string): Promise<void> => {
  await fetch(new URL(RELEASE_HELD_BUNDLES_PATH, mockServerBaseUrl), { method: "POST" });
};

export const startMockSseServer = (): Promise<MockSseServer> => {
  return new Promise((resolve, reject) => {
    const heldStreams = new Set<ServerResponse>();
    const server: Server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        const { pathname } = new URL(req.url!, "http://localhost");

        if (req.method === "OPTIONS") {
          handlePreflight(req, res);
          return;
        }

        if (req.method !== "POST") {
          res.writeHead(405);
          res.end();
          return;
        }

        if (pathname === "/server/sse/v1") {
          handleServerSseRequest(req, res, heldStreams);
        }
        else if (pathname === "/client/sse/v1") {
          handleClientSseRequest(req, res);
        }
        else if (pathname === RELEASE_HELD_BUNDLES_PATH) {
          releaseHeldStreams(heldStreams, res);
        }
        else if (
          pathname === "/server/telemetry/v1"
          || pathname === "/client/telemetry/v1"
        ) {
          handleTelemetryRequest(req, res);
        }
        else {
          res.writeHead(404);
          res.end();
        }
      },
    );

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        port,
        baseUrl,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res())),
          ),
      });
    });

    server.on("error", reject);
  });
};
