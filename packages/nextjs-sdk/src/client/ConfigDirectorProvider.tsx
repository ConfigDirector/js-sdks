"use client";

import { Component, type PropsWithChildren } from "react";
import { createBrowserClient, type ConfigDirectorClient } from "@js-browser-client/index";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState } from "./types";

/**
 * Initializes the ConfigDirector browser client and provides it to all descendant hooks.
 *
 * Place this in your root layout, wrapping your application. In most cases prefer the
 * `ConfigDirectorProvider` exported from `@configdirector/nextjs-sdk/server` — it is a React
 * Server Component that populates `initialConfigs` automatically, ensuring Client Components
 * render the correct values during SSR without any extra wiring.
 *
 * This component itself is a Client Component, so if you use it directly (rather than through
 * the server provider) any `sdkKey` sourced from `process.env` must use the `NEXT_PUBLIC_`
 * prefix — Next.js only exposes prefixed variables to code that runs in the browser.
 */
export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorProviderOptions>,
  ConfigDirectorProviderState
> {
  private client: ConfigDirectorClient | undefined;

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
        logger: createConsoleLogger(this.props.logLevel ?? "warn"),
        hooks: this.props.hooks,
      },
    );
  }

  override async componentDidMount(): Promise<void> {
    const client = this.buildClient();
    this.client = client;

    client.on("configsUpdated", () => {
      this.setState({ updatedAt: new Date() });
    });
    client.on("clientReady", () => {
      this.setState({ status: "ready" });
    });

    this.setState({ client });

    await client.initialize(this.props.context);
    if (this.client === client && !client.isReady) {
      this.setState({ status: "default" });
    }
  }

  override async componentDidUpdate(
    prevProps: PropsWithChildren<ConfigDirectorProviderOptions>,
  ): Promise<void> {
    if (prevProps.context !== this.props.context) {
      const client = this.client;
      if (!client) return;
      this.setState({ status: "loading" });
      await client.updateContext(this.props.context ?? {});
      if (this.client === client && !client.isReady) {
        this.setState({ status: "default" });
      }
    }
  }

  override componentWillUnmount(): void {
    this.client?.dispose();
    this.client = undefined;
  }

  override render() {
    return (
      <reactContext.Provider value={{ ...this.state, initialConfigs: this.props.initialConfigs }}>
        {this.props.children}
      </reactContext.Provider>
    );
  }
}
