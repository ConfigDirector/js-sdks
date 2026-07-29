import type { PropsWithChildren } from "react";
import { ConfigDirectorProvider as ClientProvider } from "@configdirector/nextjs-sdk/client";
import type { ConfigDirectorProviderOptions } from "../client/types";
import { generateSsrConfigSet } from "./ssr";
import { getAppMeta } from "./singleton";

/**
 * Props for {@link ConfigDirectorProvider}. Identical to the client provider options
 * except `initialConfigs` is omitted — SSR-evaluated values are injected automatically.
 */
export type ConfigDirectorProviderProps = Omit<ConfigDirectorProviderOptions, "initialConfigs"> & {
  /**
   * Restrict SSR pre-evaluation to these config keys. When omitted, all known configs are
   * pre-evaluated. Useful when you have a large config set and only need a subset hydrated
   * on this layout.
   */
  configKeys?: string[];
};

/**
 * React Server Component wrapper around the ConfigDirector client provider.
 *
 * Place this in your root layout. It pre-evaluates all configs on the server using the
 * provided context and passes them to the client provider, preventing any flash of wrong
 * content on hydration.
 *
 * Requires Next.js 13+ (App Router) and React 18+.
 *
 * Read `sdkKey` from a plain environment variable (e.g. `CONFIGDIRECTOR_CLIENT_KEY`), NOT one
 * prefixed with `NEXT_PUBLIC_` — even here, inside a Server Component. Next.js substitutes
 * `NEXT_PUBLIC_*` references with a literal string at compile time wherever they appear in
 * code it bundles, with no exemption for Server Components; that permanently freezes the
 * value into the build artifact the moment you reference it here, regardless of the two
 * deployment strategies below. A plain variable, by contrast, is read live from `process.env`
 * — its resolved value (not the variable lookup itself) is what gets passed as a prop to the
 * client provider below, which is how it safely reaches the browser without ever being baked
 * into the bundle as source.
 *
 * **Deploying one build artifact to multiple environments (e.g. one Docker image promoted
 * from staging to prod):** a plain variable is only read fresh per request if this component's
 * render actually re-runs on each request — otherwise Next.js still statically prerenders the
 * route once at build time and caches the output to a static HTML file, silently freezing
 * whichever value was set at build time. Make sure your root layout either reads a per-request
 * API like `cookies()` (as below, which forces dynamic rendering as a side effect) or adds
 * `export const dynamic = "force-dynamic";` if it doesn't otherwise need one. The trade-off is
 * that the route loses static generation/ISR caching, since it now renders on every request.
 *
 * **Building a separate artifact per environment:** if you'd rather keep static generation
 * (and are fine building once per environment, e.g. as a distinct step per env in CI), no
 * layout changes are needed — a plain environment variable set at build time is read once and
 * baked into the static output for that build, same as `NEXT_PUBLIC_` would be, just without
 * also exposing it to arbitrary client-side code that isn't a descendant of this provider.
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
 *           sdkKey={process.env.CONFIGDIRECTOR_CLIENT_KEY!}
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
  configKeys,
  ...props
}: PropsWithChildren<ConfigDirectorProviderProps>) {
  const initialConfigs = generateSsrConfigSet({ context: props.context, configKeys });
  const appMeta = getAppMeta();
  return (
    <ClientProvider
      {...props}
      appName={props.appName ?? appMeta.appName}
      appVersion={props.appVersion ?? appMeta.appVersion}
      initialConfigs={initialConfigs}>
      {children}
    </ClientProvider>
  );
}
