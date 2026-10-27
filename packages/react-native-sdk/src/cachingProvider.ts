import type { CachingProvider } from "@js-client-core/index";
import { CACHED_VALUES_STORAGE_KEY_PREFIX, DEFAULT_CACHING_SIZE_LIMIT_BYTES } from "@js-client-core/cached-values";
import type { AsyncStorageLookup } from "./asyncStorage";

export const asyncStorageCachingProvider =
  (asyncStorage: Promise<AsyncStorageLookup>) =>
  (clientSdkKeyDigest: Promise<string>): CachingProvider => {
    const storageKey = clientSdkKeyDigest.then((digest) => CACHED_VALUES_STORAGE_KEY_PREFIX + digest);
    return {
      read: async () => {
        const lookup = await asyncStorage;
        return lookup.outcome === "installed" ? lookup.storage.getItem(await storageKey) : undefined;
      },
      write: async (value) => {
        const lookup = await asyncStorage;
        if (lookup.outcome === "installed") {
          await lookup.storage.setItem(await storageKey, value);
        }
      },
      remove: async () => {
        const lookup = await asyncStorage;
        if (lookup.outcome === "installed") {
          await lookup.storage.removeItem(await storageKey);
        }
      },
      sizeLimit: () => DEFAULT_CACHING_SIZE_LIMIT_BYTES,
    };
  };
