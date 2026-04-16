import { describe, test, expect } from "vitest";
import { EventSourceParser } from "../src/EventSourceParser";
import type { EventSourceMessage } from "../src/types";

// Helper to create a parser and collect all events/retries/comments
function createParser() {
  const events: Array<EventSourceMessage> = [];
  const retries: number[] = [];
  const comments: string[] = [];

  const parser = new EventSourceParser({
    onEvent: (event) => events.push(event),
    onRetry: (retry) => retries.push(retry),
    onComment: (comment) => comments.push(comment),
  });

  return { parser, events, retries, comments };
}

describe("EventSourceParser", () => {
  describe("basic event dispatching", () => {
    test("dispatches an event when an empty line is encountered after data", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\n\n");
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe("hello");
    });

    test("does not dispatch an event for an empty line with no accumulated data", () => {
      const { parser, events } = createParser();
      parser.parse("\n");
      expect(events).toHaveLength(0);
    });

    test("does not dispatch an event when only id or type are set but data is empty", () => {
      const { parser, events } = createParser();
      parser.parse("id: 1\nevent: test\n\n");
      expect(events).toHaveLength(0);
    });

    test("resets the current event after dispatching", () => {
      const { parser, events } = createParser();
      parser.parse("data: first\n\ndata: second\n\n");
      expect(events).toHaveLength(2);
      expect(events[0].data).toBe("first");
      expect(events[1].data).toBe("second");
    });

    test("resets event type after dispatching", () => {
      const { parser, events } = createParser();
      parser.parse("event: custom\ndata: first\n\ndata: second\n\n");
      expect(events[0].type).toBe("custom");
      expect(events[1].type).toBeUndefined();
    });

    test("carries the last event ID to subsequent events that do not set a new id", () => {
      // Spec §9.2.6: "The buffer does not get reset, so the last event ID string of the event source
      // remains set to this value until the next time it is set by the server."
      const { parser, events } = createParser();
      parser.parse("id: 42\ndata: first\n\ndata: second\n\n");
      expect(events[0].id).toBe("42");
      expect(events[1].id).toBe("42");
    });
  });

  describe("data field", () => {
    test("parses a simple data field", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\n\n");
      expect(events[0].data).toBe("hello");
    });

    test("strips leading space after colon from value", () => {
      const { parser, events } = createParser();
      parser.parse("data: value\n\n");
      expect(events[0].data).toBe("value");
    });

    test("does not strip more than one leading space", () => {
      const { parser, events } = createParser();
      parser.parse("data:  two spaces\n\n");
      expect(events[0].data).toBe(" two spaces");
    });

    test("parses data with no space after colon", () => {
      const { parser, events } = createParser();
      parser.parse("data:value\n\n");
      expect(events[0].data).toBe("value");
    });

    test("concatenates multiple data lines with newlines between them", () => {
      const { parser, events } = createParser();
      parser.parse("data: line1\ndata: line2\ndata: line3\n\n");
      expect(events[0].data).toBe("line1\nline2\nline3");
    });

    test("treats a data line with no value as an empty string (appending a newline)", () => {
      const { parser, events } = createParser();
      parser.parse("data:\ndata: second\n\n");
      expect(events[0].data).toBe("\nsecond");
    });

    test("does not dispatch when data field has no colon and no value — empty data buffer suppresses dispatch", () => {
      // Per spec: field with no colon → value is "". After stripping trailing LF, data is "".
      // Empty data buffer means the event is NOT dispatched.
      const { parser, events } = createParser();
      parser.parse("data\n\n");
      expect(events).toHaveLength(0);
    });
  });

  describe("event type field", () => {
    test("sets the event type", () => {
      const { parser, events } = createParser();
      parser.parse("event: message\ndata: hello\n\n");
      expect(events[0].type).toBe("message");
    });

    test("uses the last event field value if specified multiple times", () => {
      const { parser, events } = createParser();
      parser.parse("event: first\nevent: second\ndata: hello\n\n");
      expect(events[0].type).toBe("second");
    });

    test("does not set type if event field is absent", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\n\n");
      expect(events[0].type).toBeUndefined();
    });
  });

  describe("id field", () => {
    test("sets the event id", () => {
      const { parser, events } = createParser();
      parser.parse("id: 123\ndata: hello\n\n");
      expect(events[0].id).toBe("123");
    });

    test("ignores id field containing a null character (U+0000)", () => {
      const { parser, events } = createParser();
      parser.parse("id: abc\u0000def\ndata: hello\n\n");
      expect(events[0].id).toBeUndefined();
    });

    test("accepts id with empty value", () => {
      const { parser, events } = createParser();
      parser.parse("id:\ndata: hello\n\n");
      expect(events[0].id).toBe("");
    });

    test("accepts id with no space after colon", () => {
      const { parser, events } = createParser();
      parser.parse("id:42\ndata: hello\n\n");
      expect(events[0].id).toBe("42");
    });
  });

  describe("retry field", () => {
    test("calls onRetry with the parsed integer", () => {
      const { parser, retries } = createParser();
      parser.parse("retry: 3000\n\n");
      expect(retries).toEqual([3000]);
    });

    test("ignores retry if value contains non-digit characters", () => {
      const { parser, retries } = createParser();
      parser.parse("retry: 3000ms\n\n");
      expect(retries).toHaveLength(0);
    });

    test("ignores retry if value is empty", () => {
      const { parser, retries } = createParser();
      parser.parse("retry:\n\n");
      expect(retries).toHaveLength(0);
    });

    test("ignores retry if value contains a float", () => {
      const { parser, retries } = createParser();
      parser.parse("retry: 1.5\n\n");
      expect(retries).toHaveLength(0);
    });

    test("processes retry without dispatching an event if data is empty", () => {
      const { parser, events, retries } = createParser();
      parser.parse("retry: 5000\n\n");
      expect(events).toHaveLength(0);
      expect(retries).toEqual([5000]);
    });
  });

  describe("comments", () => {
    test("calls onComment for lines starting with colon", () => {
      const { parser, comments } = createParser();
      parser.parse(": this is a comment\n\n");
      expect(comments).toEqual(["this is a comment"]);
    });

    test("calls onComment for colon-only lines (empty comment)", () => {
      const { parser, comments } = createParser();
      parser.parse(":\n\n");
      expect(comments).toEqual([""]);
    });

    test("does not dispatch an event for a comment line", () => {
      const { parser, events } = createParser();
      parser.parse(": comment\n\n");
      expect(events).toHaveLength(0);
    });

    test("can mix comments and data fields in the same event block", () => {
      const { parser, events, comments } = createParser();
      parser.parse(": keep-alive\ndata: hello\n\n");
      expect(comments).toEqual(["keep-alive"]);
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe("hello");
    });
  });

  describe("unknown fields", () => {
    test("silently ignores unknown field names", () => {
      const { parser, events } = createParser();
      parser.parse("unknown: value\ndata: hello\n\n");
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe("hello");
    });
  });

  describe("line ending variants", () => {
    test("handles LF line endings", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\n\n");
      expect(events[0].data).toBe("hello");
    });

    test("handles CR line endings", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\r\r");
      expect(events[0].data).toBe("hello");
    });

    test("handles CRLF line endings", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\r\n\r\n");
      expect(events[0].data).toBe("hello");
    });

    test("handles mixed line endings within the same chunk", () => {
      const { parser, events } = createParser();
      parser.parse("data: line1\r\ndata: line2\n\r\n");
      expect(events[0].data).toBe("line1\nline2");
    });
  });

  describe("BOM stripping", () => {
    test("strips Unicode BOM (U+FEFF) from the start of the first chunk", () => {
      const { parser, events } = createParser();
      parser.parse("\uFEFFdata: hello\n\n");
      expect(events[0].data).toBe("hello");
    });

    test("strips UTF-8 BOM (bytes 0xEF 0xBB 0xBF as individual chars) at the start of the first chunk", () => {
      const bom = "\xEF\xBB\xBF";
      const { parser, events } = createParser();
      parser.parse(`${bom}data: hello\n\n`);
      expect(events[0].data).toBe("hello");
    });

    test("does not strip BOM if it appears after the start of the stream", () => {
      const bom = "\xEF\xBB\xBF";
      const { parser, events } = createParser();
      parser.parse(`data: ${bom}hello\n\n`);
      expect(events[0].data).toBe(`${bom}hello`);
    });
  });

  describe("chunked / streaming input", () => {
    test("handles a field split across two chunks", () => {
      const { parser, events } = createParser();
      parser.parse("data: hel");
      parser.parse("lo\n\n");
      expect(events[0].data).toBe("hello");
    });

    test("handles the event delimiter split across two chunks", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\n");
      parser.parse("\n");
      expect(events[0].data).toBe("hello");
    });

    test("handles multiple events delivered in a single chunk", () => {
      const { parser, events } = createParser();
      parser.parse("data: one\n\ndata: two\n\ndata: three\n\n");
      expect(events).toHaveLength(3);
      expect(events.map((e) => e.data)).toEqual(["one", "two", "three"]);
    });

    test("handles events split across many small single-character chunks", () => {
      const { parser, events } = createParser();
      const input = "data: hello\n\n";
      for (const char of input) {
        parser.parse(char);
      }
      expect(events[0].data).toBe("hello");
    });

    test("accumulates incomplete line and processes it on the next chunk", () => {
      const { parser, events } = createParser();
      parser.parse("data: par");
      parser.parse("tial\n\n");
      expect(events[0].data).toBe("partial");
    });
  });

  describe("finish()", () => {
    test("does not dispatch when stream ends without a trailing newline", () => {
      // Per spec: incomplete events (no final empty line) are discarded at end of stream.
      const { parser, events } = createParser();
      parser.parse("data: hello");
      parser.finish();
      expect(events).toHaveLength(0);
    });

    test("does not dispatch when stream ends with a single trailing newline and no empty line", () => {
      // Per spec: "If the file ends in the middle of an event, before the final empty line,
      // the incomplete event is not dispatched."
      const { parser, events } = createParser();
      parser.parse("data: hello\n");
      parser.finish();
      expect(events).toHaveLength(0);
    });

    test("does not re-dispatch a completed event when finish is called after a full stream", () => {
      const { parser, events } = createParser();
      parser.parse("data: complete\n\n");
      parser.finish();
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe("complete");
    });
  });

  describe("spec examples", () => {
    // Examples taken from https://html.spec.whatwg.org/multipage/server-sent-events.html

    test("parses multi-line data from the spec 'data only' example", () => {
      const { parser, events } = createParser();
      parser.parse("data: YHOO\ndata: +2\ndata: 10\n\n");
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe("YHOO\n+2\n10");
    });

    test("parses named events from the spec 'named events' example", () => {
      const { parser, events } = createParser();
      parser.parse(
        "event: add\ndata: 73857293\n\nevent: remove\ndata: 2153\n\nevent: add\ndata: 113411\n\n",
      );
      expect(events).toHaveLength(3);
      expect(events[0]).toMatchObject({ type: "add", data: "73857293" });
      expect(events[1]).toMatchObject({ type: "remove", data: "2153" });
      expect(events[2]).toMatchObject({ type: "add", data: "113411" });
    });

    test("carries the last event ID to events that do not set a new id", () => {
      // Spec: the last event ID buffer persists until explicitly changed by a new id field.
      const { parser, events } = createParser();
      parser.parse("id: 1\ndata: first event\n\nid: 2\ndata: second event\n\ndata: third event\n\n");
      expect(events[0]).toMatchObject({ id: "1", data: "first event" });
      expect(events[1]).toMatchObject({ id: "2", data: "second event" });
      expect(events[2].id).toBe("2");
    });

    test("does not dispatch when data field has no colon and resolves to empty value", () => {
      const { parser, events } = createParser();
      parser.parse("data\n\n");
      expect(events).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    test("handles a stream with only comments and no events", () => {
      const { parser, events, comments } = createParser();
      parser.parse(": ping\n: pong\n\n");
      expect(events).toHaveLength(0);
      expect(comments).toEqual(["ping", "pong"]);
    });

    test("handles very long data values", () => {
      const { parser, events } = createParser();
      const longValue = "x".repeat(100_000);
      parser.parse(`data: ${longValue}\n\n`);
      expect(events[0].data).toBe(longValue);
    });

    test("does not throw when onEvent callback is not provided", () => {
      const parser = new EventSourceParser({});
      expect(() => parser.parse("data: hello\n\n")).not.toThrow();
    });

    test("does not throw when onRetry callback is not provided", () => {
      const parser = new EventSourceParser({});
      expect(() => parser.parse("retry: 1000\n\n")).not.toThrow();
    });

    test("does not throw when onComment callback is not provided", () => {
      const parser = new EventSourceParser({});
      expect(() => parser.parse(": comment\n\n")).not.toThrow();
    });

    test("handles an empty input string", () => {
      const { parser, events } = createParser();
      expect(() => parser.parse("")).not.toThrow();
      expect(events).toHaveLength(0);
    });

    test("handles multiple consecutive empty lines (only one event dispatched per data block)", () => {
      const { parser, events } = createParser();
      parser.parse("data: hello\n\n\n\n");
      expect(events).toHaveLength(1);
    });

    test("handles a field with a colon in its value", () => {
      const { parser, events } = createParser();
      parser.parse("data: key:value\n\n");
      expect(events[0].data).toBe("key:value");
    });

    test("handles JSON data correctly", () => {
      const { parser, events } = createParser();
      const json = JSON.stringify({ foo: "bar", n: 42 });
      parser.parse(`data: ${json}\n\n`);
      expect(events[0].data).toBe(json);
    });
  });
});
