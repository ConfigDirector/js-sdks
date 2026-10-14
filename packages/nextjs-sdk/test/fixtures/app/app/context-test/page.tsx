"use client";

import { useClient, useConfigValue, useConfigDirectorStatus, useContext } from "@configdirector/nextjs-sdk/client";
import { useState } from "react";

const ClientContextId = () => {
  const { client } = useClient();
  return <div data-testid="client-context-id">{client.context?.id ?? "none"}</div>;
};

export default function ContextTestPage() {
  const { value: welcomeMessage } = useConfigValue("welcome-message", "default-message");
  const { readyStatus } = useConfigDirectorStatus();
  const { updateContext } = useContext();
  const [contextId, setContextId] = useState<string>("none");

  const setUserContext = async () => {
    await updateContext({ id: "test-user-1", name: "Test User" });
    setContextId("test-user-1");
  };

  const setInvalidKindContext = async () => {
    await updateContext({ id: "test-user-2", kind: "Tenant" });
    setContextId("after-invalid-kind");
  };

  return (
    <div>
      <div data-testid="welcome">{welcomeMessage}</div>
      <div data-testid="status">{readyStatus}</div>
      <div data-testid="context-id">{contextId}</div>
      <button data-testid="set-context-btn" onClick={setUserContext}>
        Set Context
      </button>
      <button data-testid="set-invalid-kind-context-btn" onClick={setInvalidKindContext}>
        Set Context With Invalid Kind
      </button>
      {readyStatus !== "loading" && <ClientContextId />}
    </div>
  );
}
