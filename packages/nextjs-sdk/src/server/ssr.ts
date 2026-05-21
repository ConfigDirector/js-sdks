import type { ConfigDirectorContext, ConfigState } from "@js-server-sdk/types";
import { getConfigClient } from "./singleton";
import { createDefaultLogger } from "./logger";

const logger = createDefaultLogger();

export type GenerateSsrConfigSetOptions = {
  /** User context for targeting rule evaluation. */
  context?: ConfigDirectorContext;
  /**
   * Restrict the returned config set to these keys. When omitted, all known configs are
   * returned. Useful when you want to pre-evaluate only a specific subset of flags.
   */
  configKeys?: string[];
};

/**
 * Evaluates configs server-side and returns a map of {@link ConfigState} objects keyed by
 * config key, suitable for passing as `initialConfigs` to `ConfigDirectorProvider`.
 *
 * Returns an empty object when the server SDK isn't initialized yet (e.g. during
 * `next build` static analysis without a live connection).
 *
 * In most cases you don't need this directly — use the `ConfigDirectorProvider` exported
 * from `@configdirector/nextjs-sdk/server`, which calls this automatically.
 */
export function generateSsrConfigSet(options?: GenerateSsrConfigSetOptions): Record<string, ConfigState> {
  try {
    return getConfigClient().getAllConfigs(options);
  } catch (error) {
    logger.error("Error retrieving SSR config set:", error);
    return {};
  }
}
