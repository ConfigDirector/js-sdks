import { reactContext } from "./context";
import { createConsoleLogger } from "./logger";
import { Component, type PropsWithChildren } from "react";
import type { ConfigDirectorClient, ConfigDirectorContext } from "@js-browser-client/index";
import { decideMountAction } from "@js-client-core/mountAction";
import { deepEqual } from "@shared/deepEqual";
import { buildClient, hasGivenClient, resolveClientSource } from "./clientSource";
import { ClientHandlers } from "@js-client-core/clientHandlers";
import type { ConfigDirectorProviderOptions, ConfigDirectorProviderProps, ConfigDirectorProviderState } from "./types";

export class ConfigDirectorProvider extends Component<
  PropsWithChildren<ConfigDirectorProviderProps>,
  ConfigDirectorProviderState
> {
  private readonly ownsClient: boolean;
  private disposedOwnClient = false;
  private handlers: ClientHandlers | undefined;

  constructor(props: ConfigDirectorProviderProps) {
    super(props);
    const source = resolveClientSource(props);
    this.ownsClient = source.owned;
    this.state = { client: source.client, status: source.client.isReady ? "ready" : "loading" };
  }

  override async componentDidMount(): Promise<void> {
    let client = this.state.client as ConfigDirectorClient;
    if (this.ownsClient && this.disposedOwnClient) {
      client = buildClient(this.props as ConfigDirectorProviderOptions);
      this.disposedOwnClient = false;
      this.setState({ client, status: "loading" });
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
    if (!client.isReady) {
      this.setState({ status: "default" });
    }
  }

  override async componentDidUpdate(prevProps: PropsWithChildren<ConfigDirectorProviderProps>): Promise<void> {
    if (hasGivenClient(prevProps) && hasGivenClient(this.props) && prevProps.client !== this.props.client) {
      createConsoleLogger("warn").warn(
        "The client prop of ConfigDirectorProvider changed after it mounted and is ignored. Remount the provider, for example with a new key, to use another client.",
      );
    }
    if (!deepEqual(prevProps.context, this.props.context)) {
      this.setState({ status: "loading" });
      await this.state.client?.updateContext(this.props.context ?? {});
      if (!this.state.client?.isReady) {
        this.setState({ status: "default" });
      }
    }
  }

  override componentWillUnmount(): void {
    this.handlers?.removeAll();
    this.handlers = undefined;
    if (this.ownsClient) {
      this.state.client?.dispose();
      this.disposedOwnClient = true;
    }
  }

  override render() {
    return <reactContext.Provider value={this.state}>{this.props.children}</reactContext.Provider>;
  }
}
