import type { CachingProvider } from "@js-client-core/index";
import { CACHED_VALUES_STORAGE_KEY_PREFIX, DEFAULT_CACHING_SIZE_LIMIT_BYTES } from "@js-client-core/cached-values";
import { localStorageIfAvailable } from "@js-client-core/browser-globals";

export const localStorageCachingProvider = (clientSdkKeyDigest: Promise<string>): CachingProvider | undefined => {
  const storage = localStorageIfAvailable();
  if (!storage) {
    return undefined;
  }
  const storageKey = clientSdkKeyDigest.then((digest) => CACHED_VALUES_STORAGE_KEY_PREFIX + digest);
  return {
    read: async () => storage.getItem(await storageKey),
    write: async (value) => storage.setItem(await storageKey, value),
    remove: async () => storage.removeItem(await storageKey),
    sizeLimit: () => DEFAULT_CACHING_SIZE_LIMIT_BYTES,
  };
};
