"use client";

import type { ReactNode } from "react";
import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";

// Standalone client provider for hooks testing. Shadows the root layout's provider so
// hooks-test pages use this client (which writes to window globals) rather than the root one.
export default function HooksTestLayout({ children }: { children: ReactNode }) {
  return (
    <ConfigDirectorProvider
      sdkKey={process.env["NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY"] ?? ""}
      url={process.env["NEXT_PUBLIC_CONFIGDIRECTOR_BASE_URL"]}
      timeout={2_000}
      hooks={{
        clientReady: () => {
          (window as any).__hooksTest = (window as any).__hooksTest ?? {};
          (window as any).__hooksTest.clientReadyFired = true;
        },
        configsUpdated: ({ keys }: { keys: string[] }) => {
          (window as any).__hooksTest = (window as any).__hooksTest ?? {};
          (window as any).__hooksTest.configsUpdatedFired = true;
          (window as any).__hooksTest.configsUpdatedKeys = keys;
        },
        contextUpdated: ({ context }: { context: unknown }) => {
          (window as any).__hooksTest = (window as any).__hooksTest ?? {};
          (window as any).__hooksTest.contextUpdatedFired = true;
          (window as any).__hooksTest.contextUpdatedContext = context;
        },
      }}>
      {children}
    </ConfigDirectorProvider>
  );
}
