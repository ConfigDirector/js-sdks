import { ConfigDirectorValidationError } from "@shared/errors";
import type { ConnectionOptions, OfflineValues } from "./types";

export type LiveConnectionMode = "streaming" | "polling";

export type OfflineSource =
  | { kind: "in-code-defaults" }
  | { kind: "file"; path: string }
  | { kind: "values"; values: OfflineValues }
  | { kind: "rejected"; message: string };

export type ConnectionPlan =
  | { kind: "connect"; mode: LiveConnectionMode; serverSdkKey: string; baseUrl: URL }
  | { kind: "stay-offline"; source: OfflineSource };

const defaultBaseUrl = new URL("https://server-sdk-api.configdirector.com");

export const planConnection = (
  serverSdkKey: string | undefined,
  connection: ConnectionOptions | undefined,
): ConnectionPlan => {
  if (connection?.mode === "offline") {
    return { kind: "stay-offline", source: offlineSourceOf(connection) };
  }
  const mode = connection?.mode ?? "streaming";
  if (!serverSdkKey || serverSdkKey.trim().length == 0) {
    throw new ConfigDirectorValidationError(
      "No server SDK key was provided, the client cannot be instantiated without a valid server SDK key",
    );
  }
  if (connection?.file !== undefined || connection?.values !== undefined) {
    return {
      kind: "stay-offline",
      source: {
        kind: "rejected",
        message: `The connection options 'file' and 'values' apply only when the connection mode is 'offline', but the mode is '${mode}'.`,
      },
    };
  }
  return { kind: "connect", mode, serverSdkKey, baseUrl: baseUrlOf(connection?.url) };
};

const baseUrlOf = (url: string | undefined): URL => {
  if (!url) {
    return defaultBaseUrl;
  }
  try {
    return new URL(url);
  } catch (error) {
    throw new ConfigDirectorValidationError(`Invalid base URL '${url}'. Parsing failed: ${error}`);
  }
};

const offlineSourceOf = (connection: ConnectionOptions): OfflineSource => {
  if (connection.file !== undefined && connection.values !== undefined) {
    return { kind: "rejected", message: "An offline connection takes either 'file' or 'values', not both." };
  }
  if (connection.file !== undefined) {
    return { kind: "file", path: connection.file };
  }
  if (connection.values !== undefined) {
    return { kind: "values", values: connection.values };
  }
  return { kind: "in-code-defaults" };
};
