export type PollingIntervalDefaults = {
  defaultSeconds: number;
  minimumSeconds: number;
};

export type ResolvedPollingInterval = {
  seconds: number;
  warning: string | undefined;
};

export const resolvePollingInterval = (
  configuredSeconds: number | undefined,
  defaults: PollingIntervalDefaults,
): ResolvedPollingInterval => {
  if (configuredSeconds === undefined) {
    return { seconds: defaults.defaultSeconds, warning: undefined };
  }
  if (configuredSeconds >= defaults.minimumSeconds) {
    return { seconds: configuredSeconds, warning: undefined };
  }
  return {
    seconds: defaults.minimumSeconds,
    warning: `pollingInterval of ${configuredSeconds} seconds is below the minimum of ${defaults.minimumSeconds} seconds. Using ${defaults.minimumSeconds} seconds.`,
  };
};
