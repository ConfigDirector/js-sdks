import EventEmitter from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ConfigDirectorInitializationError, ConfigDirectorValidationError } from "@shared/errors";
import type { ConfigDefinition, OfflineValues, Transport, TransportEvents } from "./types";
import type { OfflineSource } from "./connection-plan";
import { unconditionalConfig } from "./native-values";

const OFFLINE_ENVIRONMENT = { environmentId: "offline", projectId: "offline" };

export class OfflineTransport implements Transport {
  private readonly emitter = new EventEmitter();
  private connected = false;

  constructor(private readonly source: OfflineSource) {}

  public async connect(): Promise<this> {
    const configs = await loadOfflineConfigs(this.source);
    this.connected = true;
    this.emitter.emit("configBundleReceived", { ...OFFLINE_ENVIRONMENT, kind: "full", configs });
    return this;
  }

  public get isConnected(): boolean {
    return this.connected;
  }

  public on<TName extends keyof TransportEvents>(name: TName, handler: (payload: TransportEvents[TName]) => void) {
    this.emitter.on(name, handler);
  }

  public off<TName extends keyof TransportEvents>(name: TName, handler?: (payload: TransportEvents[TName]) => void) {
    if (handler) {
      this.emitter.off(name, handler);
    } else {
      this.emitter.removeAllListeners(name);
    }
  }

  public close() {
    this.connected = false;
  }

  public dispose() {
    this.close();
    this.emitter.removeAllListeners();
  }
}

const loadOfflineConfigs = async (source: OfflineSource): Promise<Record<string, ConfigDefinition>> => {
  switch (source.kind) {
    case "in-code-defaults":
      return {};
    case "values":
      return encodeOfflineValues(source.values, "The offline values");
    case "file":
      return encodeOfflineValues(await readOfflineValuesFile(source.path), `The offline values file '${source.path}'`);
    case "rejected":
      throw new ConfigDirectorInitializationError(source.message);
  }
};

const readOfflineValuesFile = async (path: string): Promise<OfflineValues> => {
  let text: string;
  try {
    text = await readFile(resolve(path), "utf8");
  } catch (error) {
    throw new ConfigDirectorInitializationError(
      `The offline values file '${path}' could not be read: ${messageOf(error)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConfigDirectorInitializationError(
      `The offline values file '${path}' is not valid JSON: ${messageOf(error)}`,
    );
  }
  if (!isJsonObject(parsed)) {
    throw new ConfigDirectorInitializationError(
      `The offline values file '${path}' must hold a JSON object with one value per config key, but holds ${describeJson(parsed)}.`,
    );
  }
  return parsed;
};

const encodeOfflineValues = (values: OfflineValues, subject: string): Record<string, ConfigDefinition> => {
  try {
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, unconditionalConfig(`offline:${key}`, key, value)]),
    );
  } catch (error) {
    if (error instanceof ConfigDirectorValidationError) {
      throw new ConfigDirectorInitializationError(`${subject} could not be loaded. ${error.message}`);
    }
    throw error;
  }
};

const isJsonObject = (parsed: unknown): parsed is OfflineValues =>
  typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);

const describeJson = (parsed: unknown): string => {
  if (parsed === null) {
    return "null";
  }
  if (Array.isArray(parsed)) {
    return "an array";
  }
  return `a ${typeof parsed}`;
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));
