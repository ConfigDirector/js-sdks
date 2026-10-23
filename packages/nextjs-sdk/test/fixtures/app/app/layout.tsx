import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  return (
    <html lang="en">
      <body>
        <ConfigDirectorProvider
          sdkKey={process.env["CONFIGDIRECTOR_CLIENT_KEY"]}
          url={process.env["CONFIGDIRECTOR_BASE_URL"]}
          timeout={2_000}
          context={userId ? { id: userId } : undefined}
          deferInitialization={cookieStore.get("deferInitialization")?.value === "true"}
        >
          {children}
        </ConfigDirectorProvider>
      </body>
    </html>
  );
}
