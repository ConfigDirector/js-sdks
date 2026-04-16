import { type ConfigDirectorLogger } from "./types";
import type { UrlLike } from "./url";

export const fetchWithTimeout = async (
  timeout: number,
  resource: string | UrlLike | Request,
  options: RequestInit | undefined,
  logger: ConfigDirectorLogger,
) => {
  const abortController = new AbortController();
  const abortTimeoutId = setTimeout(() => {
    logger.debug("[fetchWithTimeout] Reached timeout, aborting request");
    abortController.abort();
  }, timeout);

  try {
    const response = await fetch(typeof resource === "string" || resource instanceof Request ? resource : resource.toString(), {
      ...options,
      signal: abortController.signal,
    });
    clearTimeout(abortTimeoutId);
    return response;
  } catch (error) {
    logger.warn("[fetchWithTimeout] Fetch error: ", error);
    clearTimeout(abortTimeoutId);
    throw error;
  }
};
