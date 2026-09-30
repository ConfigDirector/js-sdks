import type {
  ClientConnectAction,
  ConfigDirectorContext,
  ConfigDirectorLogger,
  ConfigSet,
  ConfigState,
  Transport,
  TransportEvents,
} from "../types";
import { Emitter } from "../Emitter";
import { ConfigDirectorConnectionError } from "../errors";
import { encodeTestValue, type TestValue, type TestValues } from "./values";

type ControlledAttempt = "initialize" | "updateContext";

type Armed = "nothing" | "hold" | "failure";

type PendingHold = {
  attempt: ControlledAttempt;
  end: () => void;
  complete: () => void;
  fail: () => void;
};

const TEST_ENVIRONMENT = { environmentId: "test-environment", projectId: "test-project" };

const controlledAttemptFor = (reason: ClientConnectAction): ControlledAttempt | undefined => {
  switch (reason) {
    case "initialization":
      return "initialize";
    case "context update":
      return "updateContext";
    default:
      return undefined;
  }
};

export class InMemoryConnection implements Transport {
  private readonly emitter = new Emitter<TransportEvents>();
  private readonly configs = new Map<string, ConfigState>();
  private readonly recordedContexts: ConfigDirectorContext[] = [];
  private readonly pendingDeliveries: ConfigSet[] = [];
  private readonly armed: Record<ControlledAttempt, Armed> = { initialize: "nothing", updateContext: "nothing" };
  private pendingHold: PendingHold | undefined;
  private connected = false;
  private delivering = false;
  private revision = 0;
  private attemptGeneration = 0;

  constructor(
    private readonly logger: ConfigDirectorLogger,
    values: TestValues,
  ) {
    this.store(values);
  }

  public get contextUpdates(): ConfigDirectorContext[] {
    return [...this.recordedContexts];
  }

  public setValue(key: string, value: TestValue) {
    const configState = encodeTestValue(key, value, ++this.revision);
    this.configs.set(key, configState);
    this.deliverIfConnected({ ...TEST_ENVIRONMENT, kind: "delta", configs: { [key]: configState } });
  }

  public removeValue(key: string) {
    this.configs.delete(key);
    this.deliverIfConnected(this.fullUpdate());
  }

  public replaceValues(values: TestValues) {
    const encoded = this.encodeAll(values);
    this.configs.clear();
    encoded.forEach((configState, key) => this.configs.set(key, configState));
    this.armed.initialize = "nothing";
    this.armed.updateContext = "nothing";
    this.deliverIfConnected(this.fullUpdate());
  }

  public hold(attempt: ControlledAttempt) {
    this.armed[attempt] = "hold";
  }

  public complete(attempt: ControlledAttempt) {
    if (this.pendingHold?.attempt === attempt) {
      this.pendingHold.complete();
    } else if (this.armed[attempt] === "hold") {
      this.armed[attempt] = "nothing";
    }
  }

  public fail(attempt: ControlledAttempt) {
    if (this.pendingHold?.attempt === attempt) {
      this.pendingHold.fail();
    } else {
      this.armed[attempt] = "failure";
    }
  }

  public connect(context: ConfigDirectorContext, timeout: number, reason: ClientConnectAction): Promise<this> {
    this.endAttempt();
    const attempt = controlledAttemptFor(reason);
    if (!attempt) {
      return this.connectNow();
    }
    this.recordedContexts.push(context);
    const armed = this.armed[attempt];
    this.armed[attempt] = "nothing";
    switch (armed) {
      case "failure":
        return this.failNow(reason);
      case "hold":
        return this.holdNow(attempt, reason, timeout);
      default:
        return this.connectNow();
    }
  }

  public on: Transport["on"] = (name, handler) => this.emitter.on(name, handler);

  public off: Transport["off"] = (name, handler) => this.emitter.off(name, handler);

  public clear() {
    this.emitter.clear();
  }

  public close() {
    this.endAttempt();
  }

  public dispose() {
    this.close();
    this.clear();
  }

  private endAttempt() {
    this.attemptGeneration++;
    this.connected = false;
    this.pendingHold?.end();
  }

  private connectNow(): Promise<this> {
    const connected = Promise.resolve(this);
    this.scheduleFirstDelivery();
    return connected;
  }

  private holdNow(attempt: ControlledAttempt, reason: ClientConnectAction, timeout: number): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      const timer = setTimeout(() => this.pendingHold?.end(), timeout);
      const release = () => {
        clearTimeout(timer);
        this.pendingHold = undefined;
      };
      this.pendingHold = {
        attempt,
        end: () => {
          release();
          resolve(this);
        },
        complete: () => {
          release();
          resolve(this);
          this.scheduleFirstDelivery();
        },
        fail: () => {
          release();
          const error = this.fatalError(reason);
          this.emitter.emit("connectionError", error);
          reject(error);
        },
      };
    });
  }

  private failNow(reason: ClientConnectAction): Promise<this> {
    const error = this.fatalError(reason);
    this.emitter.emit("connectionError", error);
    return Promise.reject(error);
  }

  private fatalError(reason: ClientConnectAction) {
    return new ConfigDirectorConnectionError(
      `Connection failed with status: 401. Error: the test client failed this ${reason}. This is an unrecoverable error, will not attempt to reconnect.`,
      401,
    );
  }

  private scheduleFirstDelivery() {
    const generation = this.attemptGeneration;
    void Promise.resolve()
      .then(() => {})
      .then(() => {
        if (generation !== this.attemptGeneration) {
          return;
        }
        this.connected = true;
        this.deliver(this.fullUpdate());
      });
  }

  private deliverIfConnected(configSet: ConfigSet) {
    if (this.connected) {
      this.deliver(configSet);
    }
  }

  private deliver(configSet: ConfigSet) {
    this.pendingDeliveries.push(configSet);
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

  private emitCaught(configSet: ConfigSet) {
    try {
      this.emitter.emit("configSetReceived", configSet);
    } catch (error) {
      this.logger.error("[InMemoryConnection] Error dispatching a config update from the test client: ", error);
    }
  }

  private fullUpdate(): ConfigSet {
    return { ...TEST_ENVIRONMENT, kind: "full", configs: Object.fromEntries(this.configs) };
  }

  private store(values: TestValues) {
    this.encodeAll(values).forEach((configState, key) => this.configs.set(key, configState));
  }

  private encodeAll(values: TestValues): Map<string, ConfigState> {
    const encoded = new Map<string, ConfigState>();
    for (const [key, value] of Object.entries(values)) {
      encoded.set(key, encodeTestValue(key, value, ++this.revision));
    }
    return encoded;
  }
}
