"use client";

import { useConfigValue, useConfigDirectorStatus, useContext } from "@configdirector/nextjs-sdk/client";
import { useState } from "react";

export default function ContextTestPage() {
  const { value: welcomeMessage } = useConfigValue("welcome-message", "default-message");
  const { readyStatus } = useConfigDirectorStatus();
  const { updateContext } = useContext();
  const [contextId, setContextId] = useState<string>("none");

  const setUserContext = async () => {
    await updateContext({ id: "test-user-1", name: "Test User" });
    setContextId("test-user-1");
  };

  return (
    <div>
      <div data-testid="welcome">{welcomeMessage}</div>
      <div data-testid="status">{readyStatus}</div>
      <div data-testid="context-id">{contextId}</div>
      <button data-testid="set-context-btn" onClick={setUserContext}>
        Set Context
      </button>
    </div>
  );
}
