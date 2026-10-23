import type { CachingOptions, CachingProvider, ConfigDirectorContext, ConfigDirectorLogger, ConfigStateMap } from "./types";
import type { ConnectionPlan } from "./connection-plan";
import { utf8ByteLength } from "@shared/utf8-byte-length";

const ENTRY_FORMAT_VERSION = 1;
const DEFAULT_CONTEXT_KIND = "user";

export const CACHED_VALUES_STORAGE_KEY_PREFIX = "configdirector-sdk:cached-values:";
export const DEFAULT_CACHING_SIZE_LIMIT_BYTES = 256 * 1024;

export type ContextTag =
  | { contextKind: string; contextId: string }
  | { contextKind: string; anonymousInstanceId: string };

export type CachedValues = {
  contextTag: ContextTag;
  environmentId: string;
  projectId: string;
  configs: ConfigStateMap;
  receivedAt: number;
};

type CachedValuesEntry = CachedValues & {
  formatVersion: typeof ENTRY_FORMAT_VERSION;
  clientSdkKey: string;
};

export type CachedValuesRead =
  | { outcome: "stored"; cachedValues: CachedValues }
  | { outcome: "nothing stored" }
  | { outcome: "unreadable" }
  | { outcome: "failed" };

export type CachingPlan =
  | { kind: "cache"; provider: CachingProvider; clientSdkKey: string }
  | { kind: "no cache"; reason: "offline mode" | "turned off" | "no provider available" };

export type CachedValuesAdoption = "adopt" | "live values already arrived" | "context mismatch";

export const planCaching = (
  connectionPlan: ConnectionPlan,
  caching: CachingOptions | undefined,
  platformProvider: ((clientSdkKey: string) => CachingProvider | undefined) | undefined,
): CachingPlan => {
  if (connectionPlan.kind === "stay-offline") {
    return { kind: "no cache", reason: "offline mode" };
  }
  if (caching?.enabled === false) {
    return { kind: "no cache", reason: "turned off" };
  }
  const provider = caching?.provider ?? platformProvider?.(connectionPlan.clientSdkKey);
  if (!provider) {
    return { kind: "no cache", reason: "no provider available" };
  }
  return { kind: "cache", provider, clientSdkKey: connectionPlan.clientSdkKey };
};

export const contextTagFor = (context: ConfigDirectorContext | undefined, instanceId: string): ContextTag => {
  const contextKind = context?.kind ?? DEFAULT_CONTEXT_KIND;
  if (context?.id != null) {
    return { contextKind, contextId: context.id };
  }
  return { contextKind, anonymousInstanceId: instanceId };
};

const sameContextTag = (stored: ContextTag, launch: ContextTag): boolean => {
  if (stored.contextKind !== launch.contextKind) {
    return false;
  }
  if ("contextId" in stored && "contextId" in launch) {
    return stored.contextId === launch.contextId;
  }
  if ("anonymousInstanceId" in stored && "anonymousInstanceId" in launch) {
    return stored.anonymousInstanceId === launch.anonymousInstanceId;
  }
  return false;
};

export const decideCachedValuesAdoption = (
  cachedValues: CachedValues,
  launchContextTag: ContextTag,
  hasReceivedLiveValues: boolean,
): CachedValuesAdoption => {
  if (hasReceivedLiveValues) {
    return "live values already arrived";
  }
  if (!sameContextTag(cachedValues.contextTag, launchContextTag)) {
    return "context mismatch";
  }
  return "adopt";
};

const isContextTag = (candidate: unknown): candidate is ContextTag => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const { contextKind, contextId, anonymousInstanceId } = candidate as Record<string, unknown>;
  if (typeof contextKind !== "string") {
    return false;
  }
  return typeof contextId === "string" || typeof anonymousInstanceId === "string";
};

const isConfigStateMap = (candidate: unknown): candidate is ConfigStateMap => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }
  return Object.values(candidate).every(
    (config) =>
      config && typeof config === "object" && typeof config.id === "string" && typeof config.key === "string",
  );
};

const isEntryFor = (clientSdkKey: string, candidate: unknown): candidate is CachedValuesEntry => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const entry = candidate as Partial<CachedValuesEntry>;
  return (
    entry.formatVersion === ENTRY_FORMAT_VERSION &&
    entry.clientSdkKey === clientSdkKey &&
    isContextTag(entry.contextTag) &&
    typeof entry.environmentId === "string" &&
    typeof entry.projectId === "string" &&
    isConfigStateMap(entry.configs) &&
    typeof entry.receivedAt === "number"
  );
};

type Warning = "read failed" | "unreadable" | "over the size limit" | "write failed" | "remove failed";

export class CachedValuesStore {
  private readonly warned = new Set<Warning>();
  private pendingRead: Promise<CachedValuesRead> | undefined;
  private queuedCachedValues: CachedValues | undefined;
  private writing = false;

  constructor(
    private readonly provider: CachingProvider,
    private readonly clientSdkKey: string,
    private readonly logger: ConfigDirectorLogger,
  ) {}

  public read(): Promise<CachedValuesRead> {
    this.pendingRead ??= this.readEntry();
    return this.pendingRead;
  }

  public replace(cachedValues: CachedValues) {
    this.queuedCachedValues = cachedValues;
    void this.writeQueued();
  }

  private async readEntry(): Promise<CachedValuesRead> {
    let raw: string | null | undefined;
    try {
      raw = await this.provider.read();
    } catch (error) {
      this.warnOnce("read failed", "Could not read the values kept on the device, starting without them:", error);
      return { outcome: "failed" };
    }
    if (raw == null || raw === "") {
      return { outcome: "nothing stored" };
    }

    const entry = this.parseEntry(raw);
    if (!entry) {
      this.warnOnce("unreadable", "The values kept on the device could not be read and were removed, starting without them");
      await this.removeEntry();
      return { outcome: "unreadable" };
    }
    return { outcome: "stored", cachedValues: entry };
  }

  private parseEntry(raw: string): CachedValuesEntry | undefined {
    try {
      const candidate: unknown = JSON.parse(raw);
      return isEntryFor(this.clientSdkKey, candidate) ? candidate : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeQueued() {
    if (this.writing) {
      return;
    }
    this.writing = true;
    try {
      while (this.queuedCachedValues) {
        const cachedValues = this.queuedCachedValues;
        this.queuedCachedValues = undefined;
        await this.writeEntry(cachedValues);
      }
    } finally {
      this.writing = false;
    }
  }

  private async writeEntry(cachedValues: CachedValues) {
    const entry: CachedValuesEntry = {
      formatVersion: ENTRY_FORMAT_VERSION,
      clientSdkKey: this.clientSdkKey,
      ...cachedValues,
    };
    const serialized = JSON.stringify(entry);
    const size = utf8ByteLength(serialized);
    const limit = this.provider.sizeLimit();
    if (size > limit) {
      this.warnOnce(
        "over the size limit",
        `The values received (${size} bytes) exceed the caching provider's limit of ${limit} bytes, so no values are kept on the device`,
      );
      await this.removeEntry();
      return;
    }
    try {
      await this.provider.write(serialized);
    } catch (error) {
      this.warnOnce("write failed", "Could not keep the values on the device:", error);
    }
  }

  private async removeEntry() {
    try {
      await this.provider.remove();
    } catch (error) {
      this.warnOnce("remove failed", "Could not remove the values kept on the device:", error);
    }
  }

  private warnOnce(warning: Warning, message: string, ...details: unknown[]) {
    if (this.warned.has(warning)) {
      return;
    }
    this.warned.add(warning);
    this.logger.warn(`[ConfigDirectorClient] ${message}`, ...details);
  }
}
