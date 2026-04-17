import type { InjectionKey } from "vue";
import { inject } from "vue";
import { ConfigDirectorInitializationError } from "@shared/errors";

export const injectOrThrow = <T>(key: InjectionKey<T>): T => {
  const injected = inject(key);
 if (injected === undefined) {
    throw new ConfigDirectorInitializationError(
      `Could not inject ${key.description} from ConfigDirectorPlugin. Make sure the ConfigDirectorPlugin is installed.`,
    );
  }
  return injected;
};
