export type ReconnectionState = {
  attempt: number;
  serverReconnectionTime: number;
  status?: number | undefined;
  error?: Error | undefined;
};

export enum ReadyState {
  OPEN = "open",
  CLOSED = "closed",
  CONNECTING = "connecting",
}

export type EventSourceClientOptions = {
  url: { toString(): string } | string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | (() => string);
  mode?: "cors" | "no-cors" | "same-origin";
  credentials?: "include" | "omit" | "same-origin";
  redirect?: "error" | "follow";
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  lastEventId?: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: EventSourceMessageHandler;
  onComment?: EventSourceCommentHandler;
  shouldReconnect?: (state: ReconnectionState) => boolean;
  calculateReconnectDelay?: (state: ReconnectionState) => number;
};

export type EventSourceMessage = {
  id?: string | undefined;
  type?: string;
  data: string;
};

export type EventSourceMessageHandler = (message: EventSourceMessage) => void;
export type EventSourceCommentHandler = (comment: string) => void;

export type EventParserRetryCallback = (retry: number) => void;

export type EventSourceParserOptions = {
  onEvent?: EventSourceMessageHandler;
  onRetry?: EventParserRetryCallback;
  onComment?: EventSourceCommentHandler;
};
