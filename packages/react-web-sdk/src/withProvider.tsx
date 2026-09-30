import { useEffect, useState, type ReactNode } from "react";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import { decideMountAction } from "@js-client-core/mountAction";
import type { ConfigDirectorContext } from "@js-browser-client/index";
import { buildClient } from "./clientSource";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState } from "./types";

export const withProvider = async (options: ConfigDirectorProviderOptions) => {
  const client =
    readInstalledTestClient() ?? buildClient({ ...options, logger: options.logger ?? createConsoleLogger("debug") });
  switch (decideMountAction(client, options.context)) {
    case "initialize":
      await client.initialize(options.context);
      break;
    case "updateContext":
      await client.updateContext(options.context as ConfigDirectorContext);
      break;
    case "none":
      break;
  }

  const ConfigDirectorProvider = ({ children }: { children: ReactNode }) => {
    const [data, setData] = useState<ConfigDirectorProviderState>(() => ({
      client,
      status: client.isReady ? "ready" : "default",
    }));

    useEffect(() => {
      const onConfigsUpdated = () => {
        setData((prevState) => ({ ...prevState, updatedAt: new Date() }));
      };
      const onClientReady = () => {
        setData((prevState) => (prevState.status === "ready" ? prevState : { ...prevState, status: "ready" }));
      };
      client.on("configsUpdated", onConfigsUpdated);
      client.on("clientReady", onClientReady);
      if (client.isReady) {
        onClientReady();
      }
      return () => {
        client.off("configsUpdated", onConfigsUpdated);
        client.off("clientReady", onClientReady);
      };
    }, []);

    return <reactContext.Provider value={data}>{children}</reactContext.Provider>;
  };

  return ConfigDirectorProvider;
};
