import type { Page, Route } from "playwright";
import type { ConfigDirectorContext } from "@js-client-core/types";
import { CLIENT_BUNDLE } from "./mock-sse-server";

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "access-control-allow-origin": "*",
};

const CORS_PREFLIGHT_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type",
  "access-control-allow-methods": "POST",
};

export type ClientConnectionRequest = { givenContext?: ConfigDirectorContext; instanceId?: string };

const answersPreflight = async (route: Route): Promise<boolean> => {
  if (route.request().method() !== "OPTIONS") {
    return false;
  }
  await route.fulfill({ status: 204, headers: CORS_PREFLIGHT_HEADERS });
  return true;
};

const connectionRequestOf = (route: Route): ClientConnectionRequest =>
  JSON.parse(route.request().postData() ?? "{}") as ClientConnectionRequest;

export const serveClientBundle = async (page: Page, connectionRequests: ClientConnectionRequest[]): Promise<void> => {
  await page.route("**/client/sse/v1", async (route) => {
    if (await answersPreflight(route)) return;
    connectionRequests.push(connectionRequestOf(route));
    await route.fulfill({ status: 200, headers: SSE_HEADERS, body: `data: ${JSON.stringify(CLIENT_BUNDLE)}\n\n` });
  });
};

export const refuseClientConnections = async (page: Page, connectionRequests: ClientConnectionRequest[]): Promise<void> => {
  await page.unroute("**/client/sse/v1");
  await page.route("**/client/sse/v1", async (route) => {
    if (await answersPreflight(route)) return;
    connectionRequests.push(connectionRequestOf(route));
    await route.abort();
  });
};

export const acceptTelemetry = async (page: Page): Promise<void> => {
  await page.route("**/client/telemetry/v1", async (route) => {
    if (await answersPreflight(route)) return;
    await route.fulfill({ status: 202, headers: { "access-control-allow-origin": "*" } });
  });
};
