import type { ConfigDirectorContext } from "@js-browser-client/index";
import { ConfigDirectorContextKey } from "../plugin";
import { useClient } from "./useClient";
import { injectOrThrow } from "./util";

export const useContext = () => {
  const { client } = useClient();
  const currentContext = injectOrThrow(ConfigDirectorContextKey);

  const updateContext = async (context: ConfigDirectorContext) => {
    const oldContextJson = JSON.stringify(client.context);
    const newContextJson = JSON.stringify(context);
    if (oldContextJson != newContextJson) {
      await client.updateContext(context);
    }
  };

  return {
    context: currentContext,
    updateContext,
  };
};
