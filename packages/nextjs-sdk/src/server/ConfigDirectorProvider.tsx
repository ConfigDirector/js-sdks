import type { PropsWithChildren } from "react";
import { ConfigDirectorProvider as ClientProvider } from "@configdirector/nextjs-sdk/client";
import type { ConfigDirectorProviderOptions } from "../client/types";
import { generateSsrConfigSet } from "./ssr";

/**
 * Props for {@link ConfigDirectorProvider}. Identical to the client provider options
 * except `initialConfigs` is omitted — SSR-evaluated values are injected automatically.
 */
export type ConfigDirectorProviderProps = Omit<ConfigDirectorProviderOptions, "initialConfigs">;

/**
 * React Server Component wrapper around the ConfigDirector client provider.
 *
 * Place this in your root layout. It pre-evaluates all configs on the server using the
 * provided context and passes them to the client provider, preventing any flash of wrong
 * content on hydration.
 *
 * Requires Next.js 13+ (App Router) and React 18+.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/server";
 * import { cookies } from "next/headers";
 *
 * export default async function RootLayout({ children }) {
 *   const userId = (await cookies()).get("userId")?.value;
 *   return (
 *     <html>
 *       <body>
 *         <ConfigDirectorProvider
 *           sdkKey={process.env.NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY!}
 *           context={{ userId }}
 *         >
 *           {children}
 *         </ConfigDirectorProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export async function ConfigDirectorProvider({
  children,
  ...props
}: PropsWithChildren<ConfigDirectorProviderProps>) {
  const initialConfigs = generateSsrConfigSet({ context: props.context });
  return (
    <ClientProvider {...props} initialConfigs={initialConfigs}>
      {children}
    </ClientProvider>
  );
}
