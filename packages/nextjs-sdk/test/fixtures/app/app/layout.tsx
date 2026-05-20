import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/server";
import type { ReactNode } from "react";

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConfigDirectorProvider
          sdkKey={process.env["NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY"] ?? ""}
          url={process.env.NEXT_PUBLIC_CONFIGDIRECTOR_BASE_URL}
          timeout={2_000}
        >
          {children}
        </ConfigDirectorProvider>
      </body>
    </html>
  );
}
