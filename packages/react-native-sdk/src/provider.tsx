import { createClient } from "./client";
import { createConsoleLogger } from "./logger";
import { reactContext } from "./context";
import { Component, type PropsWithChildren } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderState, NetInfoState } from "./types";

export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorProviderOptions>,
  ConfigDirectorProviderState
> {
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private netInfoUnsubscribe: (() => void) | null = null;
  private wasOffline = false;

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
    this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);
    if (this.props.netInfoSubscribe) {
      this.netInfoUnsubscribe = this.props.netInfoSubscribe(this.handleConnectivityChange);
    }
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

  private handleAppStateChange = async (nextState: AppStateStatus): Promise<void> => {
    if (nextState === "active") {
      await this.reconnect();
    } else if (nextState === "background") {
      this.state.client?.pauseNetwork();
    }
  };

  private handleConnectivityChange = ({ isConnected }: NetInfoState): void => {
    if (!isConnected) {
      this.wasOffline = true;
    } else if (this.wasOffline && AppState.currentState !== "background") {
      this.wasOffline = false;
      void this.reconnect();
    }
  };

  private reconnect = async (): Promise<void> => {
    await this.state.client?.resumeNetwork();
  };

  override componentWillUnmount(): void {
    this.appStateSubscription?.remove();
    this.netInfoUnsubscribe?.();
    this.state.client?.dispose();
    this.disposedOwnClient = true;
  }

  override render() {
    return <reactContext.Provider value={this.state}>{this.props.children}</reactContext.Provider>;
  }
}
