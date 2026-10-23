"use client";

import { useClient, useConfigDirectorStatus, useContext } from "@configdirector/nextjs-sdk/client";
import { useEffect } from "react";

const MOUNT_CONTEXT = { id: "mount-user" };

const ClientContextId = () => {
  const { client } = useClient();
  return <div data-testid="client-context-id">{client.context?.id ?? "none"}</div>;
};

export default function ContextOnMountPage() {
  const { readyStatus } = useConfigDirectorStatus();
  const { updateContext } = useContext();

  useEffect(() => {
    void updateContext(MOUNT_CONTEXT);
  }, [updateContext]);

  return (
    <div>
      <div data-testid="status">{readyStatus}</div>
      <button data-testid="update-same-context-btn" onClick={() => void updateContext({ id: "mount-user" })}>
        Update Same Context
      </button>
      {readyStatus !== "loading" && <ClientContextId />}
    </div>
  );
}
