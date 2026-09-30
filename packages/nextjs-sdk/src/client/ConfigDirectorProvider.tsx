"use client";

import { Component, type PropsWithChildren } from "react";
import { createBrowserClient, type ConfigDirectorClient, type ConfigDirectorContext } from "@js-browser-client/index";
import { ClientHandlers } from "@js-client-core/clientHandlers";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import { decideMountAction } from "@js-client-core/mountAction";
import { deepEqual } from "@shared/deepEqual";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import type {
  ConfigDirectorClientProviderProps,
  ConfigDirectorProviderOptions,
  ConfigDirectorProviderState,
} from "./types";

const hasGivenClient = (props: ConfigDirectorClientProviderProps): props is { client: ConfigDirectorClient } =>
  "client" in props && props.client !== undefined;

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
 *
 * Given a `client` prop, or while a test client is installed from
 * `@configdirector/nextjs-sdk/client/testing`, the provider provides that client from its first
 * render instead of building one, and never disposes it.
 */
export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorClientProviderProps>,
  ConfigDirectorProviderState
> {
  private client: ConfigDirectorClient | undefined;
  private readonly ownsClient: boolean;
  private handlers: ClientHandlers | undefined;

  constructor(props: PropsWithChildren<ConfigDirectorClientProviderProps>) {
    super(props);
    const givenClient = hasGivenClient(props) ? props.client : readInstalledTestClient();
    this.ownsClient = givenClient === undefined;
    this.client = givenClient;
    this.state = givenClient
      ? { client: givenClient, status: givenClient.isReady ? "ready" : "loading" }
      : { status: "loading" };
  }

  private buildClient(): ConfigDirectorClient {
    const options = this.props as ConfigDirectorProviderOptions;
    return createBrowserClient(
      options.sdkKey,
      { sdkName: "nextjs-sdk", sdkVersion: "__VERSION__" },
      {
        connection: {
          url: options.url,
          timeout: options.timeout,
          mode: options.mode,
          pollingInterval: options.pollingInterval,
        },
        metadata: { appName: options.appName, appVersion: options.appVersion },
        logger: createConsoleLogger(options.logLevel ?? "warn"),
        hooks: options.hooks,
      },
    );
  }

  override async componentDidMount(): Promise<void> {
    let client = this.client;
    if (this.ownsClient) {
      client = this.buildClient();
      this.client = client;
      this.setState({ client });
    }
    if (!client) {
      return;
    }

    this.handlers = new ClientHandlers(client);
    this.handlers.on("configsUpdated", () => {
      this.setState({ updatedAt: new Date() });
    });
    this.handlers.on("clientReady", () => {
      this.setState({ status: "ready" });
    });
    if (!this.ownsClient) {
      this.handlers.registerHooks(this.props.hooks);
    }
    await this.connect(client, this.props.context);
  }

  private async connect(client: ConfigDirectorClient, context: ConfigDirectorContext | undefined): Promise<void> {
    switch (decideMountAction(client, context)) {
      case "initialize":
        await client.initialize(context);
        break;
      case "updateContext":
        this.setState({ status: "loading" });
        await client.updateContext(context as ConfigDirectorContext);
        break;
      case "none":
        return;
    }
    if (this.client === client && !client.isReady) {
      this.setState({ status: "default" });
    }
  }

  override async componentDidUpdate(
    prevProps: PropsWithChildren<ConfigDirectorClientProviderProps>,
  ): Promise<void> {
    if (hasGivenClient(prevProps) && hasGivenClient(this.props) && prevProps.client !== this.props.client) {
      createConsoleLogger("warn").warn(
        "The client prop of ConfigDirectorProvider changed after it mounted and is ignored. Remount the provider, for example with a new key, to use another client.",
      );
    }
    if (!deepEqual(prevProps.context, this.props.context)) {
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
    this.handlers?.removeAll();
    this.handlers = undefined;
    if (this.ownsClient) {
      this.client?.dispose();
    }
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
