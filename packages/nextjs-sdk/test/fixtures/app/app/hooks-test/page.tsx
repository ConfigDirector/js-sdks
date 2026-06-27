"use client";

import { useConfigValue, useConfigDirectorStatus, useContext } from "@configdirector/nextjs-sdk/client";
import { useState } from "react";

export default function HooksTestPage() {
  const { value: welcomeMessage } = useConfigValue("welcome-message", "default-message");
  const { readyStatus } = useConfigDirectorStatus();
  const { updateContext } = useContext();
  const [contextUpdated, setContextUpdated] = useState(false);

  const handleUpdateContext = async () => {
    await updateContext({ id: "hooks-test-user" });
    setContextUpdated(true);
  };

  return (
    <div>
      <div data-testid="welcome">{welcomeMessage}</div>
      <div data-testid="status">{readyStatus}</div>
      <div data-testid="context-updated">{String(contextUpdated)}</div>
      <button data-testid="update-context-btn" onClick={handleUpdateContext}>
        Update Context
      </button>
    </div>
  );
}
