import { createClient } from "./client";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import { Component, type PropsWithChildren } from "react";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState } from "./types";

export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorProviderOptions>,
  ConfigDirectorProviderState
> {
  private disposedOwnClient = false;

  constructor(props: ConfigDirectorProviderOptions) {
    super(props);
    this.state = { client: this.buildClient(props), status: "loading" };
  }

  private buildClient(props: ConfigDirectorProviderOptions) {
    return createClient(props.sdkKey, {
      connection: {
        url: props.url,
        timeout: props.timeout,
        mode: props.mode,
        pollingInterval: props.pollingInterval,
      },
      metadata: { appName: props.appName, appVersion: props.appVersion },
      logger: props.logger ?? createConsoleLogger("warn"),
      hooks: props.hooks,
    });
  }

  override async componentDidMount(): Promise<void> {
    let client = this.state.client;
    if (!client || this.disposedOwnClient) {
      client = this.buildClient(this.props);
      this.disposedOwnClient = false;
      this.setState({ client, status: "loading" });
    }
    client.on("configsUpdated", () => {
      this.setState({ updatedAt: new Date() });
    });
    client.on("clientReady", () => {
      this.setState({ status: "ready" });
    });
    await client.initialize(this.props.context);
    if (!client.isReady) {
      this.setState({ status: "default" });
    }
  }

  override async componentDidUpdate(
    prevProps: PropsWithChildren<ConfigDirectorProviderOptions>,
  ): Promise<void> {
    if (prevProps.context !== this.props.context) {
      this.setState({ status: "loading" });
      await this.state.client?.updateContext(this.props.context ?? {});
      if (!this.state.client?.isReady) {
        this.setState({ status: "default" });
      }
    }
  }

  override componentWillUnmount(): void {
    this.state.client?.dispose();
    this.disposedOwnClient = true;
  }

  override render() {
    return <reactContext.Provider value={this.state}>{this.props.children}</reactContext.Provider>;
  }
}
