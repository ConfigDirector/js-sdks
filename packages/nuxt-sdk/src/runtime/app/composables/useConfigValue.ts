import { shallowRef, onBeforeUnmount } from "vue";
import type { Ref, ShallowRef } from "vue";
import type { ConfigValueType } from "@js-client-core/types";
import type { ClientStatus } from "../../types";
import { useClient } from "./useClient";
import { useClientStatus } from "./useClientStatus";

export const useConfigValue = <T extends ConfigValueType>(
  configKey: string,
  defaultValue: T,
): { value: ShallowRef<T>; readyStatus: Readonly<Ref<ClientStatus>>; loading: Readonly<Ref<boolean>> } => {
  const { client } = useClient();
  const { readyStatus, loading } = useClientStatus();
  const configValue = shallowRef(client.getValue<T>(configKey, defaultValue)) as ShallowRef<T>;

  const watcher = (newValue: T) => (configValue.value = newValue);
  client.watch(configKey, defaultValue, watcher);

  onBeforeUnmount(() => client.unwatch(configKey, watcher));

  return { value: configValue, readyStatus, loading };
};
