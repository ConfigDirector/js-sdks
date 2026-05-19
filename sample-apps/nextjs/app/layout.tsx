import { createSsrClient } from "@configdirector/nextjs-sdk/server";
import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";
import { NavBar } from "./NavBar";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "ConfigDirector Next.js Sample" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Pre-evaluate configs on the server so client components receive the correct values
  // during SSR, preventing a flash of wrong content on hydration.
  // Falls back to an empty object when the server SDK isn't initialized yet
  // (e.g. during `next build` static analysis without a live connection).
  let initialConfigs: Record<string, unknown> = {};
  try {
    const ssrClient = createSsrClient();
    initialConfigs = {
      "temporary-feature-flag": ssrClient.getValue("temporary-feature-flag", true),
      "permanent-kill-switch": ssrClient.getValue("permanent-kill-switch", false),
      "integer-config": ssrClient.getValue("integer-config", "10"),
      "day-of-the-week-config": ssrClient.getValue("day-of-the-week-config", "Friday"),
    };
  } catch {
    // Server SDK not yet initialized; browser client will hydrate with live values.
  }

  return (
    <html lang="en">
      <body>
        <ConfigDirectorProvider
          sdkKey={process.env["NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY"] ?? ""}
          initialConfigs={initialConfigs}
        >
          <div className="app">
            <header className="header">
              <picture className="header-logo">
                <source srcSet="/ConfigDirector-Logo-DarkMode.svg" media="(prefers-color-scheme: dark)" />
                <img src="/ConfigDirector-Logo-LightMode.svg" alt="ConfigDirector" height={32} />
              </picture>
              <NavBar />
            </header>
            <main>{children}</main>
          </div>
        </ConfigDirectorProvider>
      </body>
    </html>
  );
}
