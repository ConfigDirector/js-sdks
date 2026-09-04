import { describe, expect, test } from "vitest";
import { AbstractPollingTransport } from "../../src/transport/AbstractPollingTransport";
import { ConfigDirectorConnectionError } from "../../src/errors";

class TestPollingTransport extends AbstractPollingTransport {
  public clear(): void {}

  public handle(error: unknown) {
    this.handleFetchError(error);
  }

  public async handleResponse(response: Response) {
    await this.handleNonOkResponse(response);
  }

  public startPolling() {
    this.pollingIntervalSeconds = 60;
    this.schedulePollingInterval(() => {});
  }

  public get hasFatalError(): boolean {
    return this.fatalError;
  }
}

describe("AbstractPollingTransport", () => {
  describe("handleFetchError", () => {
    test("treats a network error (TypeError) as transient", () => {
      const transport = new TestPollingTransport();

      expect(() => transport.handle(new TypeError("Failed to fetch"))).toThrow(
        ConfigDirectorConnectionError,
      );
      expect(() => transport.handle(new TypeError("Failed to fetch"))).toThrow(
        "Connection failed with error",
      );
      expect(transport.hasFatalError).toBe(false);
    });

    test("does not mark a network error as unrecoverable", () => {
      const transport = new TestPollingTransport();

      expect(() => transport.handle(new TypeError("Failed to fetch"))).not.toThrow(/unrecoverable/);
    });

    test("treats a NotAllowedError as fatal", () => {
      const transport = new TestPollingTransport();
      const error = new Error("Permission denied");
      error.name = "NotAllowedError";

      expect(() => transport.handle(error)).toThrow(/unrecoverable/);
      expect(transport.hasFatalError).toBe(true);
    });

    test("treats a SyntaxError as a transient parse failure", () => {
      const transport = new TestPollingTransport();

      expect(() => transport.handle(new SyntaxError("Unexpected token"))).toThrow(
        "Failed to parse the response from the server",
      );
      expect(transport.hasFatalError).toBe(false);
    });

    test("treats an unknown error as transient", () => {
      const transport = new TestPollingTransport();

      expect(() => transport.handle(new Error("boom"))).toThrow("Connection failed with error");
      expect(transport.hasFatalError).toBe(false);
    });
  });

  describe("handleNonOkResponse", () => {
    test("closes the transport on a fatal response status", async () => {
      const transport = new TestPollingTransport();
      transport.startPolling();

      await expect(
        transport.handleResponse(new Response("Unauthorized", { status: 401 })),
      ).rejects.toThrow(/unrecoverable/);

      expect(transport.hasFatalError).toBe(true);
      expect(transport.isConnected).toBe(false);
    });

    test("keeps the transport open on a transient response status", async () => {
      const transport = new TestPollingTransport();
      transport.startPolling();

      await expect(
        transport.handleResponse(new Response("Server error", { status: 500 })),
      ).rejects.toThrow("Connection failed with status: 500");

      expect(transport.hasFatalError).toBe(false);
      expect(transport.isConnected).toBe(true);
      transport.close();
    });

    test("does nothing on a successful response", async () => {
      const transport = new TestPollingTransport();
      transport.startPolling();

      await transport.handleResponse(new Response("{}", { status: 200 }));

      expect(transport.hasFatalError).toBe(false);
      expect(transport.isConnected).toBe(true);
      transport.close();
    });
  });
});
