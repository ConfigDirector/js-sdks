import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// setup.ts mocks this module globally — unmock it so we test the real implementation.
jest.unmock("../src/reactNativeStreamingFetch");

import { reactNativeStreamingFetch } from "../src/reactNativeStreamingFetch";

type MockXhr = {
  readyState: number;
  status: number;
  responseText: string;
  onreadystatechange: (() => void) | null;
  onprogress: (() => void) | null;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  open: ReturnType<typeof jest.fn>;
  setRequestHeader: ReturnType<typeof jest.fn>;
  send: ReturnType<typeof jest.fn>;
  abort: ReturnType<typeof jest.fn>;
  getAllResponseHeaders: ReturnType<typeof jest.fn>;
};

let mockXhr: MockXhr;
let originalXHR: unknown;

beforeEach(() => {
  originalXHR = (globalThis as Record<string, unknown>)["XMLHttpRequest"];

  mockXhr = {
    readyState: 0,
    status: 200,
    responseText: "",
    onreadystatechange: null,
    onprogress: null,
    onload: null,
    onerror: null,
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn(),
    abort: jest.fn(),
    getAllResponseHeaders: jest.fn(
      () => "content-type: text/event-stream\r\ncache-control: no-cache\r\n",
    ),
  };

  const MockXHRConstructor = jest.fn(() => mockXhr);
  (MockXHRConstructor as unknown as Record<string, unknown>)["HEADERS_RECEIVED"] = 2;
  (globalThis as Record<string, unknown>)["XMLHttpRequest"] = MockXHRConstructor;
});

afterEach(() => {
  (globalThis as Record<string, unknown>)["XMLHttpRequest"] = originalXHR;
});

const triggerHeadersReceived = (status = 200) => {
  mockXhr.readyState = 2;
  mockXhr.status = status;
  mockXhr.onreadystatechange?.();
};

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("reactNativeStreamingFetch", () => {
  it("opens the XHR with the correct method and URL", () => {
    void reactNativeStreamingFetch("https://example.com/sse", { method: "POST" });
    expect(mockXhr.open).toHaveBeenCalledWith("POST", "https://example.com/sse");
  });

  it("defaults method to GET when not provided", () => {
    void reactNativeStreamingFetch("https://example.com/sse", {});
    expect(mockXhr.open).toHaveBeenCalledWith("GET", "https://example.com/sse");
  });

  it("sets request headers from init.headers", () => {
    void reactNativeStreamingFetch("https://example.com/sse", {
      method: "GET",
      headers: { Authorization: "Bearer token", "X-Custom": "value" },
    });
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer token");
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith("X-Custom", "value");
  });

  it("sends the request body", () => {
    void reactNativeStreamingFetch("https://example.com/sse", {
      method: "POST",
      body: '{"key":"value"}',
    });
    expect(mockXhr.send).toHaveBeenCalledWith('{"key":"value"}');
  });

  it("resolves with status and parsed response headers when headers are received", async () => {
    const promise = reactNativeStreamingFetch("https://example.com/sse", { method: "GET" });
    mockXhr.status = 200;
    triggerHeadersReceived(200);

    const response = await promise;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  it("streams body chunks via onprogress", async () => {
    const promise = reactNativeStreamingFetch("https://example.com/sse", { method: "GET" });
    triggerHeadersReceived();

    const response = await promise;
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();

    mockXhr.responseText = "data: hello\n\n";
    mockXhr.onprogress?.();

    const { value } = await reader.read();
    expect(decode(value as Uint8Array)).toBe("data: hello\n\n");

    mockXhr.responseText += "data: world\n\n";
    mockXhr.onprogress?.();

    const { value: value2 } = await reader.read();
    expect(decode(value2 as Uint8Array)).toBe("data: world\n\n");
  });

  it("closes the stream and flushes remaining text on onload", async () => {
    const promise = reactNativeStreamingFetch("https://example.com/sse", { method: "GET" });
    triggerHeadersReceived();

    const response = await promise;
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();

    mockXhr.responseText = "data: final\n\n";
    mockXhr.onload?.();

    const { value } = await reader.read();
    expect(decode(value as Uint8Array)).toBe("data: final\n\n");

    const { done: streamDone } = await reader.read();
    expect(streamDone).toBe(true);
  });

  it("rejects immediately without creating an XHR when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      reactNativeStreamingFetch("https://example.com/sse", {
        method: "GET",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(mockXhr.open).not.toHaveBeenCalled();
  });

  it("aborts the XHR and rejects the promise when signal fires before headers received", async () => {
    const controller = new AbortController();
    const promise = reactNativeStreamingFetch("https://example.com/sse", {
      method: "GET",
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(mockXhr.abort).toHaveBeenCalled();
  });

  it("aborts the XHR and closes the stream when signal fires after headers received", async () => {
    const controller = new AbortController();
    const promise = reactNativeStreamingFetch("https://example.com/sse", {
      method: "GET",
      signal: controller.signal,
    });

    triggerHeadersReceived();
    const response = await promise;
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();

    controller.abort();

    expect(mockXhr.abort).toHaveBeenCalled();
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it("rejects the promise on XHR error before headers received", async () => {
    const promise = reactNativeStreamingFetch("https://example.com/sse", { method: "GET" });

    mockXhr.onerror?.();

    await expect(promise).rejects.toThrow("Network request failed");
  });

  it("errors the stream on XHR error after headers received", async () => {
    const promise = reactNativeStreamingFetch("https://example.com/sse", { method: "GET" });
    triggerHeadersReceived();

    const response = await promise;
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();

    mockXhr.onerror?.();

    await expect(reader.read()).rejects.toThrow("Network request failed");
  });
});
