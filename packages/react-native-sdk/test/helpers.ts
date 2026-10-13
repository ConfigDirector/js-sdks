import type { ConfigDirectorLogger } from "@shared/types";

export const sleep = async (time: number) =>
  await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;

export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const createStubbedLogger = (): ConfigDirectorLogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

export const buildResponse = (stream: ReadableStream) =>
  new Response(stream as any, {
    headers: {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });

export const message = (data: object): Uint8Array =>
  new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

export const full = (configs: object = {}) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "full",
  configs,
});

export const delta = (configs: object) => ({
  environmentId: "10000000-0000-0000-0000-000000000000",
  projectId: "20000000-0000-0000-0000-000000000000",
  kind: "delta",
  configs,
});
