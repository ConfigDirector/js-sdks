import type { Ref, ShallowRef } from "vue";
import { computed } from "vue";
import type { ClientStatus } from "../../types";
import { useNuxtApp } from "#app";

export const useConfigDirectorStatus = (): {
  readyStatus: Readonly<ShallowRef<ClientStatus>>;
  loading: Readonly<Ref<boolean>>;
} => {
  const { $configDirectorClientReadyStatus } = useNuxtApp();
  const readyStatus = $configDirectorClientReadyStatus as Readonly<ShallowRef<ClientStatus>>;
  const loading = computed(() => readyStatus.value === "loading");
  return { readyStatus, loading };
};
