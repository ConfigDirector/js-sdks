import type { ConfigDirectorLogger } from "@shared/types";

export type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type AsyncStorageLookup =
  | { outcome: "installed"; storage: AsyncStorageLike }
  | { outcome: "not installed" };

const importAsyncStorage = async (): Promise<AsyncStorageLookup> => {
  try {
    const { default: storage } = await import("@react-native-async-storage/async-storage");
    return { outcome: "installed", storage };
  } catch {
    return { outcome: "not installed" };
  }
};

export const findAsyncStorage = (logger: ConfigDirectorLogger): Promise<AsyncStorageLookup> =>
  importAsyncStorage().then((lookup) => {
    if (lookup.outcome === "not installed") {
      logger.warn(
        "The ConfigDirector SDK could not find @react-native-async-storage/async-storage, so every app start looks like a new install to ConfigDirector, " +
          "a context without an id gets a new identifier each time, and no values are kept on the device between app starts. " +
          "Install it for the SDK to recognize the install across app starts and to serve the last values when the app starts without a network.",
      );
    }
    return lookup;
  });
