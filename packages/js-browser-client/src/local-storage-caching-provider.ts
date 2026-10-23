import type { CachingProvider } from "@js-client-core/index";
import { CACHED_VALUES_STORAGE_KEY_PREFIX, DEFAULT_CACHING_SIZE_LIMIT_BYTES } from "@js-client-core/cached-values";
import { localStorageIfAvailable } from "@js-client-core/browser-globals";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const storageKeyFor = async (clientSdkKey: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(clientSdkKey));
  return CACHED_VALUES_STORAGE_KEY_PREFIX + toHex(new Uint8Array(digest));
};

const subtleCryptoAvailable = (): boolean => typeof crypto !== "undefined" && crypto.subtle != null;

export const localStorageCachingProvider = (clientSdkKey: string): CachingProvider | undefined => {
  const storage = localStorageIfAvailable();
  if (!storage || !subtleCryptoAvailable()) {
    return undefined;
  }
  const storageKey = storageKeyFor(clientSdkKey);
  return {
    read: async () => storage.getItem(await storageKey),
    write: async (value) => storage.setItem(await storageKey, value),
    remove: async () => storage.removeItem(await storageKey),
    sizeLimit: () => DEFAULT_CACHING_SIZE_LIMIT_BYTES,
  };
};
