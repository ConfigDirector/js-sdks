import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/server";
import { NavBar } from "./NavBar";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "ConfigDirector Next.js Sample" };

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConfigDirectorProvider sdkKey={process.env["CONFIGDIRECTOR_CLIENT_KEY"] ?? ""}>
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
