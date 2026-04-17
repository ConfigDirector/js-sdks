import type { ConfigDirectorClient } from "@js-browser-client/index";
import { ConfigDirectorClientKey } from "../plugin";
import { injectOrThrow } from "./util";

export const useClient = (): { client: ConfigDirectorClient } => {
  const client = injectOrThrow(ConfigDirectorClientKey);
  return { client };
};
