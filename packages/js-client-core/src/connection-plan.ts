import { ConfigDirectorValidationError } from "./errors";
import { CLIENT_BASE_URL } from "@shared/constants";
import type { UrlFactory, UrlLike } from "@shared/url";
import type { ConnectionOptions, OfflineValues } from "./types";

export type LiveConnectionMode = "streaming" | "polling";

export type OfflineSource =
  | { kind: "in-code-defaults" }
  | { kind: "values"; values: OfflineValues }
  | { kind: "rejected"; message: string };

export type ConnectionPlan =
  | { kind: "connect"; mode: LiveConnectionMode; clientSdkKey: string; baseUrl: UrlLike }
  | { kind: "stay-offline"; source: OfflineSource };

export const planConnection = (
  clientSdkKey: string | undefined,
  connection: ConnectionOptions | undefined,
  urlFactory: UrlFactory,
): ConnectionPlan => {
  if (connection?.mode === "offline") {
    return { kind: "stay-offline", source: offlineSourceOf(connection) };
  }
  const mode = connection?.mode ?? "streaming";
  if (!clientSdkKey || clientSdkKey.trim().length == 0) {
    throw new ConfigDirectorValidationError(
      "No client SDK key was provided, the client cannot be instantiated without a valid client SDK key",
    );
  }
  if (connection?.values !== undefined) {
    return {
      kind: "stay-offline",
      source: {
        kind: "rejected",
        message: `The connection option 'values' applies only when the connection mode is 'offline', but the mode is '${mode}'.`,
      },
    };
  }
  return { kind: "connect", mode, clientSdkKey, baseUrl: baseUrlOf(connection?.url, urlFactory) };
};

const baseUrlOf = (url: string | undefined, urlFactory: UrlFactory): UrlLike => {
  if (!url) {
    return CLIENT_BASE_URL;
  }
  try {
    return urlFactory(url);
  } catch (error) {
    throw new ConfigDirectorValidationError(`Invalid base URL '${url}'. Parsing failed: ${error}`);
  }
};

const offlineSourceOf = (connection: ConnectionOptions): OfflineSource => {
  if (connection.values !== undefined) {
    return { kind: "values", values: connection.values };
  }
  return { kind: "in-code-defaults" };
};
