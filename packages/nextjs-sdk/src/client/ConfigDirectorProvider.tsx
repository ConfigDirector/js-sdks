"use client";

import { Component, type PropsWithChildren } from "react";
import { createBrowserClient, type ConfigDirectorClient } from "@js-browser-client/index";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState } from "./types";

/**
 * Initializes the ConfigDirector browser client and provides it to all descendant hooks.
 *
 * Place this in your root layout, wrapping your application. Pass server-evaluated
 * `initialConfigs` to ensure Client Components render the correct values during SSR and before
 * the browser client finishes initializing, preventing a flash of wrong content on hydration:
 *
 * ```tsx
 * // app/layout.tsx
 * import { createSsrClient } from "@configdirector/nextjs-sdk/server";
 * import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";
 * import { cookies } from "next/headers";
 *
 * export default async function RootLayout({ children }) {
 *   const userId = (await cookies()).get("userId")?.value;
 *   const ssrClient = createSsrClient({ userId });
 *
 *   return (
 *     <html>
 *       <body>
 *         <ConfigDirectorProvider
 *           sdkKey={process.env.NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY!}
 *           context={{ userId }}
 *           initialConfigs={{
 *             "new-dashboard": ssrClient.getValue("new-dashboard", false),
 *             "theme": ssrClient.getValue("theme", "light"),
 *           }}
 *         >
 *           {children}
 *         </ConfigDirectorProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorProviderOptions>,
  ConfigDirectorProviderState
> {
  constructor(props: PropsWithChildren<ConfigDirectorProviderOptions>) {
    super(props);
    this.state = { status: "loading" };
  }

  private buildClient(): ConfigDirectorClient {
    return createBrowserClient(
      this.props.sdkKey,
      { sdkName: "nextjs-sdk", sdkVersion: "__VERSION__" },
      {
        connection: { url: this.props.url, timeout: this.props.timeout },
        metadata: { appName: this.props.appName, appVersion: this.props.appVersion },
        logger: this.props.logger ?? createConsoleLogger("warn"),
      },
    );
  }

  override async componentDidMount(): Promise<void> {
    const client = this.buildClient();

    client.on("configsUpdated", () => {
      this.setState({ updatedAt: new Date() });
    });
    client.on("clientReady", () => {
      this.setState({ status: "ready" });
    });

    this.setState({ client });

    await client.initialize(this.props.context);
    if (!client.isReady) {
      this.setState({ status: "default" });
    }
  }

  override async componentDidUpdate(
    prevProps: PropsWithChildren<ConfigDirectorProviderOptions>,
  ): Promise<void> {
    if (prevProps.context !== this.props.context) {
      const { client } = this.state;
      if (!client) return;
      this.setState({ status: "loading" });
      await client.updateContext(this.props.context ?? {});
      if (!client.isReady) {
        this.setState({ status: "default" });
      }
    }
  }

  override componentWillUnmount(): void {
    this.state.client?.dispose();
  }

  override render() {
    return (
      <reactContext.Provider value={{ ...this.state, initialConfigs: this.props.initialConfigs }}>
        {this.props.children}
      </reactContext.Provider>
    );
  }
}
