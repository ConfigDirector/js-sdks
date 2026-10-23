import type { InstanceIdStorage } from "@js-client-core/index";
import type { AsyncStorageLookup } from "./asyncStorage";

export const asyncStorageInstanceIdStorage = (asyncStorage: Promise<AsyncStorageLookup>): InstanceIdStorage => {
  const installedAsyncStorage = async (): Promise<InstanceIdStorage> => {
    const lookup = await asyncStorage;
    switch (lookup.outcome) {
      case "installed":
        return lookup.storage;
      case "not installed":
        throw new Error("@react-native-async-storage/async-storage is not installed");
    }
  };

  return {
    getItem: async (key) => (await installedAsyncStorage()).getItem(key),
    setItem: async (key, value) => (await installedAsyncStorage()).setItem(key, value),
  };
};
