import {
  InvalidOptionError,
  MissingResponseBodyError,
  StreamClosedError,
  ValueOutOfRangeError,
} from "./errors";
import { EventSourceParser } from "./EventSourceParser";
import {
  type EventSourceClientOptions,
  type EventSourceCommentHandler,
  type EventSourceMessageHandler,
  type ReconnectionState,
  ReadyState,
} from "./types";

export class EventSourceClient {
  private readonly DEFAULT_SHOULD_RECONNECT = () => true;
  private readonly DEFAULT_CALCULATE_RECONNECT_DELAY = () => this.serverReconnectionTime;
  private readonly url: string;
  private readonly headers?: Record<string, string>;
  private readonly body: () => string | undefined;
  private readonly requestOptions;
  private lastEventId?: string;
  private reconnectAttempt: number = 0;
  private abortController: AbortController = new AbortController();
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  private _readyState: ReadyState = ReadyState.CLOSED;
  private serverReconnectionTime: number = 2_000;
  private _fetch: (url: string, init: RequestInit) => Promise<Response>;
  private _onError: (error: Error) => void;
  private _onMessage: EventSourceMessageHandler;
  private _onComment: EventSourceCommentHandler;
  private _onConnect: () => void;
  private _onDisconnect: () => void;
  private _shouldReconnect: (state: ReconnectionState) => boolean;
  private _calculateReconnectDelay: (state: ReconnectionState) => number;

  constructor(options: EventSourceClientOptions) {
    this.url = options.url.toString();
    this.lastEventId = options.lastEventId;
    this.headers = {
      Accept: "text/event-stream",
      ...options.headers,
    };
    const body = options.body;
    this.body = typeof body === "function" ? body : () => body;
    this.requestOptions = {
      method: options.method ?? "GET",
      mode: options.mode,
      credentials: options.credentials,
      redirect: options.redirect,
      referrer: options.referrer,
      referrerPolicy: options.referrerPolicy,
    };
    this._fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this._onError = this.resolveCallback(options.onError, () => {}, "onError");
    this._onConnect = this.resolveCallback(options.onConnect, () => {}, "onConnect");
    this._onDisconnect = this.resolveCallback(options.onDisconnect, () => {}, "onDisconnect");
    this._onMessage = this.resolveCallback(options.onMessage, () => {}, "onMessage");
    this._onComment = this.resolveCallback(options.onComment, () => {}, "onComment");
    this._shouldReconnect = this.resolveCallback(
      options.shouldReconnect,
      this.DEFAULT_SHOULD_RECONNECT,
      "shouldReconnect",
    );
    this._calculateReconnectDelay = this.resolveCallback(
      options.calculateReconnectDelay,
      this.DEFAULT_CALCULATE_RECONNECT_DELAY,
      "calculateReconnectDelay",
    );
  }

  public set onError(value: (error: Error) => void) {
    this._onError = this.resolveCallback(value, () => {}, "onError");
  }

  public set onMessage(value: EventSourceMessageHandler) {
    this._onMessage = this.resolveCallback(value, () => {}, "onMessage");
  }

  public set onComment(value: EventSourceCommentHandler) {
    this._onComment = this.resolveCallback(value, () => {}, "onComment");
  }

  public set onConnect(value: () => void) {
    this._onConnect = this.resolveCallback(value, () => {}, "onConnect");
  }

  public set onDisconnect(value: () => void) {
    this._onDisconnect = this.resolveCallback(value, () => {}, "onDisconnect");
  }

  public set shouldReconnect(value: (state: ReconnectionState) => boolean) {
    this._shouldReconnect = this.resolveCallback(value, this.DEFAULT_SHOULD_RECONNECT, "shouldReconnect");
  }

  public set calculateReconnectDelay(value: (state: ReconnectionState) => number) {
    this._calculateReconnectDelay = this.resolveCallback(
      value,
      this.DEFAULT_CALCULATE_RECONNECT_DELAY,
      "shouldReconnect",
    );
  }

  public get readyState(): ReadyState {
    return this._readyState;
  }

  public connect() {
    if (this._readyState !== ReadyState.CLOSED) {
      return;
    }

    this.reconnectAttempt = 0;
    this.initiateConnection();
  }

  public close() {
    clearTimeout(this.reconnectTimeout);
    this._readyState = ReadyState.CLOSED;
    this.abortController.abort();
  }

  private initiateConnection() {
    this.abortController = new AbortController();
    this._readyState = ReadyState.CONNECTING;

    this._fetch(this.url, {
      ...this.requestOptions,
      body: this.body(),
      headers: this.buildRequestHeaders(),
      signal: this.abortController.signal,
      cache: "no-store",
    })
      .then((response) => this.handleFetchResponse(response))
      .catch((error: Error) => {
        if (error.name === "AbortError" || this.abortController.signal.aborted) {
          this.close();
          return;
        }

        this._onError(error);
        this.scheduleReconnect({ error });
      });
  }

  private async handleFetchResponse(response: Response) {
    const { body, status } = response;

    if (status === 204) {
      this.disconnected();
      return;
    }

    if (status >= 400) {
      this.scheduleReconnect({ status });
      return;
    }

    if (!body) {
      throw new MissingResponseBodyError("The server response did not have a body");
    }

    this._readyState = ReadyState.OPEN;
    this._onConnect();
    this.reconnectAttempt = 0;

    const parser = new EventSourceParser({
      onEvent: (event) => {
        if (typeof event.id === "string") {
          this.lastEventId = event.id;
        }
        this._onMessage(event);
      },
      onComment: (comment) => this._onComment(comment),
      onRetry: (retryDelay) => (this.serverReconnectionTime = retryDelay),
    });

    await this.readResponseStream(body, parser);

    this.scheduleReconnect({
      status,
      error: new StreamClosedError("The server response stream was closed"),
    });
  }

  private async readResponseStream(body: ReadableStream<Uint8Array>, parser: EventSourceParser) {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    let done = false;
    while (!done) {
      const result = await reader.read();
      if (result.value) {
        parser.parse(decoder.decode(result.value, { stream: true }));
      }
      done = result.done;
    }

    parser.finish();
  }

  private disconnected() {
    clearTimeout(this.reconnectTimeout);
    this._readyState = ReadyState.CLOSED;
    this._onDisconnect();
  }

  private buildRequestHeaders(): Record<string, string> {
    const lastEventIdHeader = this.lastEventId ? { "Last-Event-ID": this.lastEventId } : undefined;
    return {
      ...this.headers,
      ...lastEventIdHeader,
    };
  }

  private scheduleReconnect(state: { status?: number; error?: Error }) {
    if (this.abortController.signal.aborted) {
      return;
    }

    clearTimeout(this.reconnectTimeout);
    this.reconnectAttempt += 1;

    const reconnectionState: ReconnectionState = {
      attempt: this.reconnectAttempt,
      status: state.status,
      error: state.error,
      serverReconnectionTime: this.serverReconnectionTime,
    };

    if (!this._shouldReconnect(reconnectionState)) {
      this.disconnected();
      return;
    }

    this._readyState = ReadyState.CONNECTING;
    let delay = this._calculateReconnectDelay(reconnectionState);

    if (!Number.isFinite(delay) || delay < 1 || delay > 1_000 * 60 * 60) {
      this._onError(
        new ValueOutOfRangeError(
          `The calculated reconnect delay is out of range: ${delay}. Defaulting to ${this.serverReconnectionTime}`,
        ),
      );
      delay = this.serverReconnectionTime;
    }

    this.reconnectTimeout = setTimeout(() => this.initiateConnection(), delay);
  }

  private resolveCallback<T extends (...args: any[]) => any>(
    provided: unknown,
    fallback: T,
    optionName: string,
  ): T {
    if (provided == null) return fallback;
    if (typeof provided !== "function") {
      throw new InvalidOptionError(`${optionName} must be a function`);
    }
    return provided as T;
  }
}
