import { afterEach, describe, expect, test, vi } from "vitest";
import { TelemetryEventCollector } from "../../src/telemetry/TelemetryEventCollector";
import type {
  EventReporter,
  EventSnapshotPreprocessor,
  ReportableEvent,
  ReporterResponse,
} from "../../src/telemetry/types";
import type { ConfigDirectorContext, ConfigDirectorLogger } from "../../src/types";

const okResponse: ReporterResponse = { success: true, fatalError: false };
const fatalResponse: ReporterResponse = { success: false, fatalError: true };

const createStubbedLogger = (): ConfigDirectorLogger => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

class TestCollector extends TelemetryEventCollector<ReportableEvent> {
  protected readonly reporter: EventReporter | undefined = undefined;
  protected _context?: ConfigDirectorContext;
  protected evaluationEventSnapshotPreprocessor: EventSnapshotPreprocessor<ReportableEvent> = {
    process: async (snapshot) => snapshot,
  };

  public flushImpl: () => Promise<ReporterResponse> = async () => okResponse;

  protected override flush(): Promise<ReporterResponse> {
    return this.flushImpl();
  }

  public flushAndSchedule(): Promise<void> {
    return this.flushAndScheduleNext();
  }

  public cancelInitialFlush(): void {
    this.cancelScheduledFlush();
  }

  public get isCollecting(): boolean {
    return this.collectEvents;
  }
}

const createCollector = (initialDelay = 100, intervalDelay = 1_000) =>
  new TestCollector({
    sdkKey: "sdk-key",
    sdkIdentity: { sdkName: "test-sdk", sdkVersion: "1.0.0" },
    logger: createStubbedLogger(),
    baseUrl: { toString: () => "https://example.com/" },
    urlFactory: (input) => ({ toString: () => input }),
    valueIdGenerator: async () => "value-id",
    initialFlushIntervalDelay: initialDelay,
    flushIntervalDelay: intervalDelay,
  });

describe("TelemetryEventCollector flush loop", () => {
  let collector: TestCollector;

  afterEach(async () => {
    collector.flushImpl = async () => okResponse;
    await collector.close();
    vi.useRealTimers();
  });

  test("keeps the flush loop alive when a flush throws", async () => {
    vi.useFakeTimers();
    collector = createCollector();
    let calls = 0;
    collector.flushImpl = async () => {
      calls++;
      if (calls === 1) {
        throw new Error("boom");
      }
      return okResponse;
    };

    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);
  });

  test("does not schedule another flush after close", async () => {
    vi.useFakeTimers();
    collector = createCollector();
    const resolvers: ((response: ReporterResponse) => void)[] = [];
    collector.flushImpl = () => new Promise<ReporterResponse>((resolve) => resolvers.push(resolve));

    await vi.advanceTimersByTimeAsync(100);
    expect(resolvers).toHaveLength(1);

    const closing = collector.close();
    resolvers.forEach((resolve) => resolve(okResponse));
    await closing;
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
  });

  test("does not stack multiple flush loops from concurrent triggers", async () => {
    vi.useFakeTimers();
    collector = createCollector();
    collector.cancelInitialFlush();
    expect(vi.getTimerCount()).toBe(0);

    const resolvers: ((response: ReporterResponse) => void)[] = [];
    collector.flushImpl = () => new Promise<ReporterResponse>((resolve) => resolvers.push(resolve));

    const first = collector.flushAndSchedule();
    const second = collector.flushAndSchedule();
    resolvers.forEach((resolve) => resolve(okResponse));
    await first;
    await second;

    expect(vi.getTimerCount()).toBe(1);
  });

  test("close completes even when the final flush throws", async () => {
    vi.useFakeTimers();
    collector = createCollector();
    collector.flushImpl = async () => {
      throw new Error("boom");
    };

    await expect(collector.close()).resolves.toBeUndefined();
  });

  test("stops collecting and does not reschedule after a fatal response", async () => {
    vi.useFakeTimers();
    collector = createCollector();
    collector.flushImpl = async () => fatalResponse;

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(0);

    expect(collector.isCollecting).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
