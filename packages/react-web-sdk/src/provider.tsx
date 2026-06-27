import { createClient } from "./client";
import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import { Component, type PropsWithChildren } from "react";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState } from "./types";

export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorProviderOptions>,
  ConfigDirectorProviderState
> {
  constructor(props: ConfigDirectorProviderOptions) {
    super(props);

    const client = createClient(props.sdkKey, {
      connection: { url: props.url, timeout: props.timeout },
      metadata: { appName: props.appName, appVersion: props.appVersion },
      logger: props.logger ?? createConsoleLogger("warn"),
      hooks: props.hooks,
    });

    this.state = { client, status: "loading" };
  }

  override async componentDidMount(): Promise<void> {
    this.state.client?.on("configsUpdated", () => {
      this.setState({ updatedAt: new Date() });
    });
    this.state.client?.on("clientReady", () => {
      this.setState({ status: "ready" });
    });
    await this.state.client?.initialize(this.props.context);
    if (!this.state.client?.isReady) {
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
  }

  override render() {
    return <reactContext.Provider value={this.state}>{this.props.children}</reactContext.Provider>;
  }
}
