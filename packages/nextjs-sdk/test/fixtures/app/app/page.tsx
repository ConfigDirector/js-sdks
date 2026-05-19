"use client";

import { useConfigValue, useConfigDirectorStatus } from "@configdirector/nextjs-sdk/client";

export default function HomePage() {
  const { value: welcomeMessage } = useConfigValue("welcome-message", "default-message");
  const { value: featureEnabled } = useConfigValue("feature-enabled", false);
  const { value: itemCount } = useConfigValue("item-count", 0);
  const { readyStatus, loading } = useConfigDirectorStatus();

  return (
    <div>
      <div data-testid="welcome">{welcomeMessage}</div>
      <div data-testid="feature-enabled">{String(featureEnabled)}</div>
      <div data-testid="item-count">{String(itemCount)}</div>
      <div data-testid="status">{readyStatus}</div>
      <div data-testid="loading">{loading ? "loading" : "done"}</div>
    </div>
  );
}
