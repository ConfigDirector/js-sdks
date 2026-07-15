import { OpenFeature } from "@openfeature/web-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-web-provider";

const sdkKey = import.meta.env.VITE_CONFIGDIRECTOR_SDK_KEY as string;
await OpenFeature.setProviderAndWait(
  new ConfigDirectorProvider(sdkKey, {
    connection: { url: import.meta.env.VITE_CONFIGDIRECTOR_URL },
  }),
);

export const client = OpenFeature.getClient();
