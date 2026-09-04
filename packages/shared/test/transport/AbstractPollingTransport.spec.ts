import { describe, expect, test } from "vitest";
import { AbstractPollingTransport } from "../../src/transport/AbstractPollingTransport";
import { ConfigDirectorConnectionError } from "../../src/errors";

class TestPollingTransport extends AbstractPollingTransport {
  public clear(): void {}

  public handle(error: unknown) {
    this.handleFetchError(error);
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
});
