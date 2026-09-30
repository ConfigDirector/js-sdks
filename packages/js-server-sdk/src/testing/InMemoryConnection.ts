import EventEmitter from "node:events";
import type { ConfigBundle, ConfigDefinition, ConfigDirectorLogger, Transport, TransportEvents } from "../types";
import { ConfigDirectorConnectionError } from "@shared/errors";
import { encodeTestValue, type TestValue, type TestValues } from "./values";

type Armed = "nothing" | "hold" | "failure";

type PendingHold = {
  end: () => void;
  complete: () => void;
  fail: () => void;
};

const TEST_ENVIRONMENT = { environmentId: "test-environment", projectId: "test-project" };

export class InMemoryConnection implements Transport {
  private readonly emitter = new EventEmitter();
  private readonly configs = new Map<string, ConfigDefinition>();
  private readonly pendingDeliveries: ConfigBundle[] = [];
  private armed: Armed = "nothing";
  private pendingHold: PendingHold | undefined;
  private connected = false;
  private delivering = false;

  constructor(
    private readonly logger: ConfigDirectorLogger,
    values: TestValues,
  ) {
    this.encodeAll(values).forEach((definition, key) => this.configs.set(key, definition));
  }

  public setValue(key: string, value: TestValue) {
    const definition = encodeTestValue(key, value);
    this.configs.set(key, definition);
    this.deliverIfConnected({ ...TEST_ENVIRONMENT, kind: "delta", configs: { [key]: definition } });
  }

  public removeValue(key: string) {
    this.configs.delete(key);
    this.deliverIfConnected(this.fullUpdate());
  }

  public replaceValues(values: TestValues) {
    const encoded = this.encodeAll(values);
    this.configs.clear();
    encoded.forEach((definition, key) => this.configs.set(key, definition));
    this.armed = "nothing";
    this.deliverIfConnected(this.fullUpdate());
  }

  public hold() {
    this.armed = "hold";
  }

  public complete() {
    if (this.pendingHold) {
      this.pendingHold.complete();
    } else if (this.armed === "hold") {
      this.armed = "nothing";
    }
  }

  public fail() {
    if (this.pendingHold) {
      this.pendingHold.fail();
    } else {
      this.armed = "failure";
    }
  }

  public connect(timeout: number): Promise<this> {
    this.endAttempt();
    const armed = this.armed;
    this.armed = "nothing";
    switch (armed) {
      case "failure":
        return this.failNow();
      case "hold":
        return this.holdNow(timeout);
      default:
        this.connectNow();
        return Promise.resolve(this);
    }
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
    this.endAttempt();
  }

  public dispose() {
    this.close();
    this.emitter.removeAllListeners();
  }

  private endAttempt() {
    this.connected = false;
    this.pendingHold?.end();
  }

  private connectNow() {
    this.connected = true;
    this.deliver(this.fullUpdate());
  }

  private holdNow(timeout: number): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      const timer = setTimeout(() => this.pendingHold?.end(), timeout);
      const release = () => {
        clearTimeout(timer);
        this.pendingHold = undefined;
      };
      this.pendingHold = {
        end: () => {
          release();
          resolve(this);
        },
        complete: () => {
          release();
          this.connectNow();
          resolve(this);
        },
        fail: () => {
          release();
          const error = this.fatalError();
          this.emitter.emit("connectionError", error);
          reject(error);
        },
      };
    });
  }

  private failNow(): Promise<this> {
    const error = this.fatalError();
    this.emitter.emit("connectionError", error);
    return Promise.reject(error);
  }

  private fatalError() {
    return new ConfigDirectorConnectionError(
      "Connection failed with status: 401. Error: the test client failed this initialization. This is an unrecoverable error, will not attempt to reconnect.",
      401,
    );
  }

  private deliverIfConnected(configBundle: ConfigBundle) {
    if (this.connected) {
      this.deliver(configBundle);
    }
  }

  private deliver(configBundle: ConfigBundle) {
    this.pendingDeliveries.push(configBundle);
    if (this.delivering) {
      return;
    }
    this.delivering = true;
    try {
      let next = this.pendingDeliveries.shift();
      while (next) {
        this.emitCaught(next);
        next = this.pendingDeliveries.shift();
      }
    } finally {
      this.delivering = false;
    }
  }

  private emitCaught(configBundle: ConfigBundle) {
    try {
      this.emitter.emit("configBundleReceived", configBundle);
    } catch (error) {
      this.logger.error("[InMemoryConnection] Error dispatching a config update from the test client: ", error);
    }
  }

  private fullUpdate(): ConfigBundle {
    return { ...TEST_ENVIRONMENT, kind: "full", configs: Object.fromEntries(this.configs) };
  }

  private encodeAll(values: TestValues): Map<string, ConfigDefinition> {
    const encoded = new Map<string, ConfigDefinition>();
    for (const [key, value] of Object.entries(values)) {
      encoded.set(key, encodeTestValue(key, value));
    }
    return encoded;
  }
}
