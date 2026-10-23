import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { CachingProvider } from "@js-client-core/index";
import { CACHED_VALUES_STORAGE_KEY_PREFIX, DEFAULT_CACHING_SIZE_LIMIT_BYTES } from "@js-client-core/cached-values";
import type { AsyncStorageLookup } from "./asyncStorage";
import { encodeUtf8 } from "./utf8Encoder";

const storageKeyFor = (clientSdkKey: string): string =>
  CACHED_VALUES_STORAGE_KEY_PREFIX + bytesToHex(sha256(encodeUtf8(clientSdkKey)));

export const asyncStorageCachingProvider =
  (asyncStorage: Promise<AsyncStorageLookup>) =>
  (clientSdkKey: string): CachingProvider => {
    const storageKey = storageKeyFor(clientSdkKey);
    return {
      read: async () => {
        const lookup = await asyncStorage;
        return lookup.outcome === "installed" ? lookup.storage.getItem(storageKey) : undefined;
      },
      write: async (value) => {
        const lookup = await asyncStorage;
        if (lookup.outcome === "installed") {
          await lookup.storage.setItem(storageKey, value);
        }
      },
      remove: async () => {
        const lookup = await asyncStorage;
        if (lookup.outcome === "installed") {
          await lookup.storage.removeItem(storageKey);
        }
      },
      sizeLimit: () => DEFAULT_CACHING_SIZE_LIMIT_BYTES,
    };
  };
