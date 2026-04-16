import { describe, expect, test } from "vitest";
import { EventQueue } from "../../src/telemetry/EventQueue";
import { EventAggregator } from "../../src/telemetry/EventAggregator";
import type { ConfigType, ConfigValueType, EvaluationReason } from "../../src/types";

type TestEvent<T extends ConfigValueType> = {
  key: string;
  type?: ConfigType;
  defaultValue: T;
  requestedType: string;
  evaluatedValue: T;
  usedDefault: boolean;
  evaluationReason: EvaluationReason;
};

describe("EventAggregator", () => {
  const aggregator = new EventAggregator();

  test("aggregates duplicate events", () => {
    const queue = new EventQueue<TestEvent<string>>();
    queue.push({
      key: "test-config-1",
      defaultValue: "Example",
      requestedType: "string",
      evaluatedValue: "Example",
      usedDefault: true,
      evaluationReason: "config-state-missing",
    });
    queue.push({
      key: "test-config-1",
      type: "string",
      defaultValue: "Example",
      requestedType: "string",
      evaluatedValue: "Hello",
      usedDefault: false,
      evaluationReason: "found-match",
    });
    queue.push({
      key: "test-config-1",
      type: "string",
      defaultValue: "Example",
      requestedType: "string",
      evaluatedValue: "Hello",
      usedDefault: false,
      evaluationReason: "found-match",
    });
    queue.push({
      key: "test-config-1",
      type: "string",
      defaultValue: "Example",
      requestedType: "string",
      evaluatedValue: "Hello",
      usedDefault: false,
      evaluationReason: "found-match",
    });

    const snapshot = queue.takeSnapshot();
    const aggregates = aggregator.aggregate(snapshot);

    expect(snapshot.events).toHaveLength(4);
    expect(aggregates).toHaveLength(2);
    expect(aggregates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({ key: "test-config-1", evaluationReason: "found-match" }),
          count: 3,
        }),
        expect.objectContaining({
          event: expect.objectContaining({ key: "test-config-1", evaluationReason: "config-state-missing" }),
          count: 1,
        }),
      ]),
    );
  });
});
