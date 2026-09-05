import { OpenFeature } from "@openfeature/web-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-web-provider";

try {
  await OpenFeature.setProviderAndWait(
    new ConfigDirectorProvider("test-client-sdk-key", {
      connection: { url: __BASE_URL__, timeout: 10_000 },
    }),
  );
  const client = OpenFeature.getClient();
  const values = {
    welcomeMessage: client.getStringValue("welcome-message", "fallback"),
    featureEnabled: client.getBooleanValue("feature-enabled", false),
    itemCount: client.getNumberValue("item-count", 0),
  };
  await OpenFeature.close();
  window.__SMOKE__ = { ok: true, values };
} catch (error) {
  window.__SMOKE__ = { ok: false, error: String(error?.stack ?? error) };
}
