import { ref, type Ref } from "vue";
import { useClient } from "./useClient";
import type { ConfigValueType } from "@js-client-core/types";

export const useConfigValue = <T extends ConfigValueType>(configKey: string, defaultValue: T): Ref<T> => {
  const { client } = useClient();
  const configValue = ref(client.getValue<T>(configKey, defaultValue)) as Ref<T>;

  client.watch(configKey, defaultValue, (newValue) => {
    configValue.value = newValue;
  });

  return configValue;
};
