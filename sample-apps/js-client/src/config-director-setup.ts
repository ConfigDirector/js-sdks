import * as amplitude from "@amplitude/analytics-browser";
import { createClient } from "@configdirector/client-sdk";
import mixpanel from "mixpanel-browser";

amplitude.init(import.meta.env.VITE_AMPLITUDE_API_KEY as string);

const mixpanelToken = import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN as string | undefined;
if (mixpanelToken) mixpanel.init(mixpanelToken);

const sentMixpanelExposureKeys = new Set<string>();

const sdkKey = import.meta.env.VITE_CONFIGDIRECTOR_SDK_KEY as string;
export const client = createClient(sdkKey, {
  connection: { url: import.meta.env.VITE_CONFIGDIRECTOR_URL },
  hooks: {
    configEvaluated: ({ evaluation }) => {
      const variationName = evaluation.variation?.name;
      if (!variationName) return;

      amplitude.track("$exposure", { flag_key: evaluation.key, variant: variationName });

      const exposureKey = `${evaluation.context?.id}/${evaluation.key}/${variationName}`;
      if (!mixpanelToken || sentMixpanelExposureKeys.has(exposureKey)) return;
      sentMixpanelExposureKeys.add(exposureKey);

      mixpanel.track("$experiment_started", {
        "Experiment name": evaluation.key,
        "Variant name": variationName,
      });
    },
    contextUpdated: ({ context }) => {
      amplitude.setUserId(context?.id);

      if (!mixpanelToken) return;
      if (context?.id) mixpanel.identify(context.id);
      else if (mixpanel.get_property("$user_id")) mixpanel.reset();
    },
  },
});
await client.initialize();
