"use client";

import { Component, useEffect, type PropsWithChildren } from "react";
import { createBrowserClient, type ConfigDirectorClient, type ConfigDirectorContext } from "@js-browser-client/index";
import { ClientHandlers } from "@js-client-core/clientHandlers";
import { readInstalledTestClient } from "@js-client-core/installedTestClient";
import { deepEqual } from "@shared/deepEqual";
import { decideGivenContextAction, decideStartupAction, startupPhaseAfter } from "./client-startup";
import type { StartupPhase } from "./client-startup";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import type {
  ClientStatus,
  ConfigDirectorClientProviderProps,
  ConfigDirectorProviderOptions,
  ConfigDirectorProviderState,
} from "./types";

const hasGivenClient = (props: ConfigDirectorClientProviderProps): props is { client: ConfigDirectorClient } =>
  "client" in props && props.client !== undefined;

const settledStatusOf = (client: ConfigDirectorClient): ClientStatus => (client.isReady ? "ready" : "default");

const decideWaitsForFirstContext = (props: ConfigDirectorClientProviderProps, ownsClient: boolean): boolean => {
  const runsOffline = ownsClient && !hasGivenClient(props) && props.mode === "offline";
  return props.deferInitialization === true && !runsOffline;
};

const RunAfterFirstRenderEffects = ({ run }: { run: () => void }) => {
  useEffect(() => {
    run();
  }, [run]);
  return null;
};

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
 * The browser client starts after the effects of the provider's first render, including its
 * children's, have run, with the latest context given by then: one given through `updateContext`
 * during those effects, otherwise the `context` prop. A context equal to the one the provider
 * already has, given through either, opens no new connection.
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
  private readonly waitsForFirstContext: boolean;
  private handlers: ClientHandlers | undefined;
  private startupPhase: StartupPhase = { kind: "beforeFirstRenderEffects" };
  private lastGivenContext: ConfigDirectorContext | undefined;

  constructor(props: PropsWithChildren<ConfigDirectorClientProviderProps>) {
    super(props);
    const givenClient = hasGivenClient(props) ? props.client : readInstalledTestClient();
    this.ownsClient = givenClient === undefined;
    this.waitsForFirstContext = decideWaitsForFirstContext(props, this.ownsClient);
    this.client = givenClient;
    this.lastGivenContext = props.context;
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
          values: options.values,
        },
        metadata: { appName: options.appName, appVersion: options.appVersion },
        logger: createConsoleLogger(options.logLevel ?? "warn"),
        hooks: options.hooks,
      },
    );
  }

  override componentDidMount(): void {
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
  }

  private readonly startAfterFirstRenderEffects = (): void => {
    const client = this.client;
    if (!client) {
      return;
    }
    void this.startClient(client, this.lastGivenContext);
  };

  private async startClient(client: ConfigDirectorClient, context: ConfigDirectorContext | undefined): Promise<void> {
    const startupAction = decideStartupAction(client, context, this.waitsForFirstContext);
    this.startupPhase = startupPhaseAfter(startupAction, client);
    switch (startupAction) {
      case "waitForContext":
        return;
      case "initialize":
        await client.initialize(context);
        this.settleStatus(client);
        return;
      case "updateContext":
        await this.updateClientContext(client, context as ConfigDirectorContext);
        return;
      case "none":
        return;
    }
  }

  private async updateClientContext(client: ConfigDirectorClient, context: ConfigDirectorContext): Promise<void> {
    this.setState({ status: "loading" });
    await client.updateContext(context);
    this.settleStatus(client);
  }

  private settleStatus(client: ConfigDirectorClient): void {
    if (this.client === client) {
      this.setState({ status: settledStatusOf(client) });
    }
  }

  private readonly receiveContext = async (context: ConfigDirectorContext | undefined): Promise<void> => {
    const decision = decideGivenContextAction(this.startupPhase, this.lastGivenContext, context);
    switch (decision.action) {
      case "skipUnchanged":
        return;
      case "keepForStartup":
        this.lastGivenContext = context;
        return;
      case "startClient":
        this.lastGivenContext = context;
        await this.startClient(decision.client, context);
        return;
      case "updateContext":
        this.lastGivenContext = context;
        await this.updateClientContext(decision.client, context ?? {});
        return;
    }
  };

  override async componentDidUpdate(
    prevProps: PropsWithChildren<ConfigDirectorClientProviderProps>,
  ): Promise<void> {
    if (hasGivenClient(prevProps) && hasGivenClient(this.props) && prevProps.client !== this.props.client) {
      createConsoleLogger("warn").warn(
        "The client prop of ConfigDirectorProvider changed after it mounted and is ignored. Remount the provider, for example with a new key, to use another client.",
      );
    }
    if (!deepEqual(prevProps.context, this.props.context)) {
      await this.receiveContext(this.props.context);
    }
  }

  override componentWillUnmount(): void {
    this.handlers?.removeAll();
    this.handlers = undefined;
    this.startupPhase = { kind: "beforeFirstRenderEffects" };
    this.lastGivenContext = this.props.context;
    if (this.ownsClient) {
      this.client?.dispose();
      this.client = undefined;
    }
  }

  override render() {
    return (
      <reactContext.Provider
        value={{ ...this.state, initialConfigs: this.props.initialConfigs, updateContext: this.receiveContext }}>
        {this.props.children}
        <RunAfterFirstRenderEffects run={this.startAfterFirstRenderEffects} />
      </reactContext.Provider>
    );
  }
}
