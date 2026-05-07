import { encodeUtf8 } from "./utf8Encoder";

// DOMException is not available in Hermes. Create abort errors using a plain
// Error with name="AbortError" — EventSourceClient only checks error.name.
const abortError = (message: string): Error => {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
};

/**
 * A fetch-compatible function for React Native that uses XMLHttpRequest to
 * support streaming SSE responses. React Native's built-in fetch accumulates
 * the entire response body before resolving, so persistent SSE connections
 * never complete. XHR's progress events fire incrementally as data arrives,
 * which we forward into a ReadableStream.
 */
export const reactNativeStreamingFetch = (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  if (init.signal?.aborted) {
    return Promise.reject(abortError("Request was aborted before it was opened"));
  }

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? "GET", url);

    const requestHeaders = init.headers as Record<string, string> | undefined;
    if (requestHeaders) {
      for (const [name, value] of Object.entries(requestHeaders)) {
        xhr.setRequestHeader(name, value);
      }
    }

    let responseResolved = false;
    let bytesForwarded = 0;
    let streamController!: ReadableStreamDefaultController<Uint8Array>;

    const responseBody = new ReadableStream<Uint8Array>({
      start(ctrl) {
        streamController = ctrl;
      },
    });

    // Encodes and enqueues any response text that has arrived since the last flush.
    const flushNewBytes = () => {
      const next = xhr.responseText.slice(bytesForwarded);
      if (next.length > 0) {
        bytesForwarded += next.length;
        streamController.enqueue(encodeUtf8(next));
      }
    };

    xhr.onreadystatechange = () => {
      // Resolve the outer promise as soon as status and headers are available,
      // without waiting for the body to finish.
      if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED && !responseResolved) {
        responseResolved = true;
        resolve({
          status: xhr.status,
          headers: parseHeaders(xhr.getAllResponseHeaders()),
          body: responseBody,
        } as unknown as Response);
      }
    };

    xhr.onprogress = () => {
      flushNewBytes();
    };

    // Fires when the server closes the connection. Flush any remaining bytes
    // that arrived with this final event, then close the stream.
    xhr.onload = () => {
      flushNewBytes();
      streamController.close();
    };

    xhr.onerror = () => {
      const err = new TypeError("Network request failed");
      if (!responseResolved) {
        reject(err);
      } else {
        streamController.error(err);
      }
    };

    if (init.signal) {
      init.signal.addEventListener("abort", () => {
        xhr.abort();
        if (!responseResolved) {
          reject(abortError("Request was aborted"));
        } else {
          try {
            streamController.close();
          } catch {
            // Stream was already closed.
          }
        }
      });
    }

    xhr.send((init.body as string | null | undefined) ?? null);
  });
};

const parseHeaders = (raw: string): Headers => {
  const headers = new Headers();
  for (const line of raw.trim().split(/\r?\n/)) {
    const sep = line.indexOf(": ");
    if (sep > 0) {
      headers.set(line.slice(0, sep), line.slice(sep + 2));
    }
  }
  return headers;
};
