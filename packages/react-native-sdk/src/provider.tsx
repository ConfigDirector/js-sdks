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

  constructor(props: ConfigDirectorProviderOptions) {
    super(props);

    const client = createClient(props.sdkKey, {
      connection: { url: props.url, timeout: props.timeout },
      metadata: { appName: props.appName, appVersion: props.appVersion },
      logger: props.logger ?? createConsoleLogger("warn"),
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
    this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);
    if (this.props.netInfoSubscribe) {
      this.netInfoUnsubscribe = this.props.netInfoSubscribe(this.handleConnectivityChange);
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
  }

  override render() {
    return <reactContext.Provider value={this.state}>{this.props.children}</reactContext.Provider>;
  }
}
