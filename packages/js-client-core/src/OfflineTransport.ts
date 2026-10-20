import { Emitter } from "./Emitter";
import { ConfigDirectorInitializationError, ConfigDirectorValidationError } from "./errors";
import type { ConfigStateMap, OfflineValues, Transport, TransportEvents } from "./types";
import type { OfflineSource } from "./connection-plan";
import { nativeValueConfigState } from "./native-values";

const OFFLINE_ENVIRONMENT = { environmentId: "offline", projectId: "offline" };

export class OfflineTransport implements Transport {
  private readonly emitter = new Emitter<TransportEvents>();

  constructor(private readonly source: OfflineSource) {}

  public async connect(): Promise<this> {
    const configs = loadOfflineConfigs(this.source);
    this.emitter.emit("configSetReceived", { ...OFFLINE_ENVIRONMENT, kind: "full", configs });
    return this;
  }

  public on: Transport["on"] = (name, handler) => this.emitter.on(name, handler);

  public off: Transport["off"] = (name, handler) => this.emitter.off(name, handler);

  public clear() {
    this.emitter.clear();
  }

  public close() {}

  public dispose() {
    this.clear();
  }
}

const loadOfflineConfigs = (source: OfflineSource): ConfigStateMap => {
  switch (source.kind) {
    case "in-code-defaults":
      return {};
    case "values":
      return encodeOfflineValues(source.values);
    case "rejected":
      throw new ConfigDirectorInitializationError(source.message);
  }
};

const encodeOfflineValues = (values: OfflineValues): ConfigStateMap => {
  try {
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, nativeValueConfigState(`offline:${key}`, key, value, undefined)]),
    );
  } catch (error) {
    if (error instanceof ConfigDirectorValidationError) {
      throw new ConfigDirectorInitializationError(`The offline values could not be loaded. ${error.message}`);
    }
    throw error;
  }
};
