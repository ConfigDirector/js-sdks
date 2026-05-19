import { createSsrClient } from "@configdirector/nextjs-sdk/server";
import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";
import type { ReactNode } from "react";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Pre-evaluate configs on the server so client components receive correct values during SSR,
  // preventing a flash of wrong content on hydration.
  const serverClient = createSsrClient();
  const initialConfigs = {
    "welcome-message": serverClient.getValue("welcome-message", "default-message"),
    "feature-enabled": serverClient.getValue("feature-enabled", false),
    "item-count": serverClient.getValue("item-count", 0),
  };

  return (
    <html lang="en">
      <body>
        <ConfigDirectorProvider
          sdkKey={process.env["NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY"] ?? ""}
          url={process.env.NEXT_PUBLIC_CONFIGDIRECTOR_BASE_URL}
          timeout={2_000}
          initialConfigs={initialConfigs}
        >
          {children}
        </ConfigDirectorProvider>
      </body>
    </html>
  );
}
