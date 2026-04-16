import {
  type EventSourceParserOptions,
  type EventSourceMessageHandler,
  type EventSourceCommentHandler,
  type EventParserRetryCallback,
} from "./types";

type ParsedField = {
  field: string;
  value: string;
};

export class EventSourceParser {
  private isFirstChunk = true;
  private bufferedInput = "";
  private currentEvent: { type?: string; data: string } = { data: "" };
  private lastEventId: string | undefined;
  private onEvent: EventSourceMessageHandler;
  private onRetry: EventParserRetryCallback | undefined;
  private onComment: EventSourceCommentHandler | undefined;

  constructor(options: EventSourceParserOptions) {
    this.currentEvent = { data: "" };
    this.onEvent = options.onEvent ?? (() => {});
    this.onRetry = options.onRetry;
    this.onComment = options.onComment;
  }

  public parse(chunk: string): void {
    let input = chunk;

    if (this.isFirstChunk) {
      this.isFirstChunk = false;
      if (input.startsWith("\uFEFF")) {
        input = input.slice(1);
      } else if (input.startsWith("\xEF\xBB\xBF")) {
        input = input.slice(3);
      }
    }

    const lines = this.scanLines(this.bufferedInput + input);
    for (const line of lines) {
      this.dispatchLine(line);
    }
  }

  // Per the SSE spec, any data still buffered when the stream ends is discarded —
  // an event requires a terminating empty line to be dispatched.
  public finish(): void {
    this.bufferedInput = "";
  }

  /**
   * Scans `text` character by character to extract complete lines, recognizing
   * CR, LF, and CRLF as line terminators per the SSE spec. Any unterminated
   * trailing text is buffered and prepended to the next chunk.
   */
  private scanLines(text: string): string[] {
    const lines: string[] = [];
    let lineStart = 0;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];
      if (ch === "\r" || ch === "\n") {
        lines.push(text.slice(lineStart, i));
        // Consume CRLF as a single terminator rather than two separate lines.
        if (ch === "\r" && text[i + 1] === "\n") {
          i++;
        }
        i++;
        lineStart = i;
      } else {
        i++;
      }
    }

    this.bufferedInput = text.slice(lineStart);
    return lines;
  }

  private dispatchLine(line: string): void {
    if (line.startsWith(":")) {
      this.onComment?.(this.extractValue(line, 1));
      return;
    }

    if (line === "") {
      this.emitEvent();
      return;
    }

    this.applyField(this.parseField(line));
  }

  private emitEvent(): void {
    const data = this.currentEvent.data.endsWith("\n")
      ? this.currentEvent.data.slice(0, -1)
      : this.currentEvent.data;

    if (data !== "") {
      this.onEvent({ ...this.currentEvent, id: this.lastEventId, data });
    }

    this.currentEvent = { data: "" };
  }

  private applyField(parsed: ParsedField): void {
    switch (parsed.field) {
      case "event":
        this.currentEvent.type = parsed.value;
        break;
      case "data":
        this.currentEvent.data += parsed.value + "\n";
        break;
      case "id":
        // Spec: ignore id values that contain a null character.
        if (!parsed.value.includes("\0")) {
          this.lastEventId = parsed.value;
        }
        break;
      case "retry":
        if (/^\d+$/.test(parsed.value)) {
          this.onRetry?.(Number.parseInt(parsed.value, 10));
        }
        break;
      default:
        break;
    }
  }

  private parseField(line: string): ParsedField {
    const colon = line.indexOf(":");
    if (colon === -1) {
      return { field: line, value: "" };
    }
    return { field: line.slice(0, colon), value: this.extractValue(line, colon + 1) };
  }

  /** Returns the value portion of a line, stripping a single leading space per spec. */
  private extractValue(line: string, from: number): string {
    return line[from] === " " ? line.slice(from + 1) : line.slice(from);
  }
}
