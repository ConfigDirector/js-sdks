/**
 * Global type declarations for Web APIs available in React Native (Hermes engine).
 *
 * This file is used instead of the TypeScript `DOM` lib so that the compiler catches
 * usage of browser-only APIs unavailable at runtime. Notably absent:
 * - DOMException: not supported in Hermes
 * - window / document: not applicable in React Native
 */

declare global {
  // --- Fetch API ---
  // React Native's built-in RequestInit is incomplete; declare all properties used by the SDKs.
  interface RequestInit {
    method?: string;
    headers?: Record<string, string> | [string, string][];
    body?: BodyInit | null;
    signal?: AbortSignal | null;
    mode?: "cors" | "navigate" | "no-cors" | "same-origin";
    credentials?: "include" | "omit" | "same-origin";
    cache?: "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload";
    redirect?: "error" | "follow" | "manual";
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    integrity?: string;
    keepalive?: boolean;
  }

  // React Native's fetch (whatwg-fetch via XHR) does not support ReadableStream as a body.
  type BodyInit = string | ArrayBuffer | ArrayBufferView;

  // React Native's built-in Response is incomplete; declare all properties used by the SDKs.
  interface Response {
    readonly body: ReadableStream<Uint8Array> | null;
    readonly status: number;
    readonly ok: boolean;
    readonly statusText: string;
    readonly url: string;
    readonly headers: Headers;
    text(): Promise<string>;
    json(): Promise<unknown>;
    arrayBuffer(): Promise<ArrayBuffer>;
  }

  class Request {
    constructor(input: string | URL | Request, init?: RequestInit);
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    readonly signal: AbortSignal;
  }

  interface Headers {
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    append(name: string, value: string): void;
    delete(name: string): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    forEach(callback: (value: string, key: string) => void): void;
  }

  function fetch(input: URL | string | Request, init?: RequestInit): Promise<Response>;

  class URL {
    constructor(url: string | URL, base?: string | URL);
    href: string;
    readonly origin: string;
    protocol: string;
    username: string;
    password: string;
    host: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
    toString(): string;
    toJSON(): string;
  }

  interface AbortSignal {
    readonly aborted: boolean;
    readonly reason: unknown;
    addEventListener(type: "abort", listener: () => void): void;
    removeEventListener(type: "abort", listener: () => void): void;
  }

  class AbortController {
    readonly signal: AbortSignal;
    abort(reason?: unknown): void;
  }

  // --- DOM lib defines ReferrerPolicy; replicate it here so eventsource types compile. ---
  type ReferrerPolicy =
    | ""
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url";

  // --- Timers ---
  // React Native's globals require a number argument; DOM lib makes it optional.
  // Overload to accept undefined so `clearTimeout(this.maybeTimer)` compiles.
  function setTimeout(handler: (...args: unknown[]) => void, timeout?: number): number;
  function setInterval(handler: (...args: unknown[]) => void, timeout?: number): number;
  function clearTimeout(handle?: number): void;
  function clearInterval(handle?: number): void;

  // --- Console (available globally in React Native via Hermes) ---
  var console: {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };

  interface XMLHttpRequestEventMap {
    readystatechange: Event;
    progress: Event;
    load: Event;
    error: Event;
    abort: Event;
  }

  class XMLHttpRequest {
    static readonly UNSENT: 0;
    static readonly OPENED: 1;
    static readonly HEADERS_RECEIVED: 2;
    static readonly LOADING: 3;
    static readonly DONE: 4;
    readonly readyState: 0 | 1 | 2 | 3 | 4;
    readonly status: number;
    readonly statusText: string;
    readonly responseText: string;
    readonly responseURL: string;
    onreadystatechange: (() => void) | null;
    onprogress: (() => void) | null;
    onload: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
    open(method: string, url: string | URL): void;
    setRequestHeader(name: string, value: string): void;
    send(body?: string | null): void;
    abort(): void;
    getResponseHeader(name: string): string | null;
    getAllResponseHeaders(): string;
  }

  // --- Encoding (available in React Native via Hermes) ---
  class TextEncoder {
    encode(input?: string): Uint8Array;
    encodeInto(source: string, destination: Uint8Array): { read: number; written: number };
    readonly encoding: string;
  }

  class TextDecoder {
    constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
    decode(input?: ArrayBuffer | ArrayBufferView, options?: { stream?: boolean }): string;
    readonly encoding: string;
    readonly fatal: boolean;
    readonly ignoreBOM: boolean;
  }

  // --- Streams API (available in React Native 0.71+) ---
  interface ReadableStreamDefaultController<R = any> {
    readonly desiredSize: number | null;
    close(): void;
    enqueue(chunk: R): void;
    error(e?: any): void;
  }

  interface UnderlyingSource<R = any> {
    start?: (controller: ReadableStreamDefaultController<R>) => void | Promise<void>;
    pull?: (controller: ReadableStreamDefaultController<R>) => void | Promise<void>;
    cancel?: (reason?: any) => void | Promise<void>;
  }

  class ReadableStream<R = any> {
    constructor(underlyingSource?: UnderlyingSource<R>);
    readonly locked: boolean;
    cancel(reason?: any): Promise<void>;
    getReader(): ReadableStreamDefaultReader<R>;
  }

  interface ReadableStreamDefaultReader<R = any> {
    readonly closed: Promise<undefined>;
    cancel(reason?: any): Promise<void>;
    read(): Promise<{ done: false; value: R } | { done: true; value: undefined }>;
    releaseLock(): void;
  }

  // --- Navigator (limited subset available in React Native) ---
  var navigator: {
    readonly onLine: boolean;
    readonly userAgent: string;
    readonly product: string;
  };
}

export {};
