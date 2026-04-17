import { ref, onBeforeUnmount } from "vue";
import type { ConfigValueType } from "@js-client-core/types";
import { useClient } from "./useClient";
import { useClientStatus } from "./useClientStatus";

export const useConfigValue = <T extends ConfigValueType>(configKey: string, defaultValue: T) => {
  const { client } = useClient();
  const { readyStatus, loading } = useClientStatus();
  const configValue = ref<T>(client.getValue<T>(configKey, defaultValue));

  const watcher = (newValue: T) => (configValue.value = newValue);
  client.watch(configKey, defaultValue, watcher);

  onBeforeUnmount(() => client.unwatch(configKey, watcher));

  return { value: configValue, readyStatus, loading };
};
