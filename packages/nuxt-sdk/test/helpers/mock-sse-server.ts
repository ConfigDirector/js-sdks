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

const sseEvent = (bundle: object): string =>
  `data: ${JSON.stringify(bundle)}\n\n`;

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

const handleSseRequest = (
  bundle: object,
  req: IncomingMessage,
  res: ServerResponse,
): void => {
  req.resume();
  req.on("end", () => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...CORS_HEADERS,
    });
    res.write(sseEvent(bundle));
    // Keep the connection open; the SDK holds it alive until it disposes.
  });
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

export const startMockSseServer = (): Promise<MockSseServer> => {
  return new Promise((resolve, reject) => {
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
          handleSseRequest(SERVER_BUNDLE, req, res);
        }
        else if (pathname === "/client/sse/v1") {
          handleSseRequest(CLIENT_BUNDLE, req, res);
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
