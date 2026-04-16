import type { ConfigDirectorLogger } from "@shared/types";

export const sleep = async (time: number) =>
  await new Promise<void>((r) => setTimeout(() => r(), time));

export const SSE_URL = "https://client-sdk-api.configdirector.com/client/sse/v1" as const;

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
  environmentId: 100,
  projectId: 200,
  kind: "full",
  configs,
});

export const delta = (configs: object) => ({
  environmentId: 100,
  projectId: 200,
  kind: "delta",
  configs,
});
