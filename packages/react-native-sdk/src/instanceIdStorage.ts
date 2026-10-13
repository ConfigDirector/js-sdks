import type { InstanceIdStorage } from "@js-client-core/index";
import type { ConfigDirectorLogger } from "@shared/types";

type AsyncStorageLookup =
  | { outcome: "installed"; storage: InstanceIdStorage }
  | { outcome: "not installed" };

const lookUpAsyncStorage = async (): Promise<AsyncStorageLookup> => {
  try {
    const { default: storage } = await import("@react-native-async-storage/async-storage");
    return { outcome: "installed", storage };
  } catch {
    return { outcome: "not installed" };
  }
};

export const asyncStorageInstanceIdStorage = (logger: ConfigDirectorLogger): InstanceIdStorage => {
  const asyncStorageLookup = lookUpAsyncStorage().then((lookup) => {
    if (lookup.outcome === "not installed") {
      logger.warn(
        "The ConfigDirector SDK could not find @react-native-async-storage/async-storage, so every app start counts as a new client session. " +
          "Install it for the SDK to keep the client session for six hours across app starts.",
      );
    }
    return lookup;
  });

  const installedAsyncStorage = async (): Promise<InstanceIdStorage> => {
    const lookup = await asyncStorageLookup;
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
