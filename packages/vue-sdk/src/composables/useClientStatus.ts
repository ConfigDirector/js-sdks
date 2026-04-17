import type { Ref } from "vue";
import { computed } from "vue";
import type { ClientStatus } from "../types";
import { injectOrThrow } from "./util";
import { ConfigDirectorStatusKey } from "../plugin";

export const useClientStatus = (): {
  readyStatus: Readonly<Ref<ClientStatus>>;
  loading: Readonly<Ref<boolean>>;
} => {
  const readyStatus = injectOrThrow(ConfigDirectorStatusKey);
  const loading = computed(() => readyStatus.value === "loading");
  return { readyStatus, loading };
};
