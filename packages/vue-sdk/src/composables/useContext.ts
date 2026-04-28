import type { ConfigDirectorContext } from "@js-browser-client/index";
import { toRaw } from "vue";
import { ConfigDirectorContextKey } from "../plugin";
import { useClient } from "./useClient";
import { injectOrThrow } from "./util";

export const useContext = () => {
  const { client } = useClient();
  const currentContext = injectOrThrow(ConfigDirectorContextKey);

  const updateContext = async (context: ConfigDirectorContext) => {
    const rawContext = toRaw(context);
    const oldContextJson = JSON.stringify(client.context);
    const newContextJson = JSON.stringify(rawContext);
    if (oldContextJson != newContextJson) {
      await client.updateContext(rawContext);
    }
  };

  return {
    context: currentContext,
    updateContext,
  };
};
