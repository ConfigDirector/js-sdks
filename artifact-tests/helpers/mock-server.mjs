import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { CLIENT_BUNDLE, SERVER_BUNDLE } from "./bundles.mjs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "600",
};

const CONTENT_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
};

const sendSse = (bundle, req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...CORS_HEADERS,
    });
    res.write(`data: ${JSON.stringify(bundle)}\n\n`);
  });
};

const sendJson = (bundle, req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json", ...CORS_HEADERS });
    res.end(JSON.stringify(bundle));
  });
};

const sendAccepted = (req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(202, CORS_HEADERS);
    res.end();
  });
};

export const startMockServer = () => {
  let staticDir;

  const serveStaticFile = async (pathname, res) => {
    const relativePath = normalize(pathname.replace(/^\/app\//, "")).replace(/^(\.\.[/\\])+/, "");
    try {
      const content = await readFile(join(staticDir, relativePath));
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extname(relativePath)] ?? "application/octet-stream",
        ...CORS_HEADERS,
      });
      res.end(content);
    } catch {
      res.writeHead(404, CORS_HEADERS);
      res.end();
    }
  };

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const { pathname } = new URL(req.url, "http://localhost");

      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      if (req.method === "GET" && staticDir && pathname.startsWith("/app/")) {
        void serveStaticFile(pathname, res);
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, CORS_HEADERS);
        res.end();
        return;
      }

      if (pathname === "/server/sse/v1") {
        sendSse(SERVER_BUNDLE, req, res);
      } else if (pathname === "/client/sse/v1") {
        sendSse(CLIENT_BUNDLE, req, res);
      } else if (pathname === "/server/polling/v1") {
        sendJson(SERVER_BUNDLE, req, res);
      } else if (pathname === "/client/polling/v1") {
        sendJson(CLIENT_BUNDLE, req, res);
      } else if (pathname.endsWith("/telemetry/v1") || pathname.endsWith("/heartbeat/v1")) {
        sendAccepted(req, res);
      } else {
        res.writeHead(404, CORS_HEADERS);
        res.end();
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        serveStatic: (dir) => {
          staticDir = dir;
        },
        close: () =>
          new Promise((done, fail) => {
            server.closeAllConnections();
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });

    server.on("error", reject);
  });
};
