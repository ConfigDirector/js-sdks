import { createClient } from "./client";
import { useEffect, useState, type ReactNode } from "react";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState } from "./types";

export const withProvider = async (options: ConfigDirectorProviderOptions) => {
  const logger = options.logger ?? createConsoleLogger("debug");
  const client = createClient(options.sdkKey, {
    connection: { url: options.url, timeout: options.timeout },
    metadata: { appName: options.appName, appVersion: options.appVersion },
    logger: logger,
    hooks: options.hooks,
  });
  await client.initialize(options.context);

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
