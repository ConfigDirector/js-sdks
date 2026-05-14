import { createClient } from "@configdirector/client-sdk";

const sdkKey = import.meta.env.VITE_CONFIGDIRECTOR_SDK_KEY as string;
export const client = createClient(sdkKey);
await client.initialize();
