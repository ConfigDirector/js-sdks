import { describe, expect, test } from "vitest";
import type { EvaluatedConfigEvent } from "@shared/telemetry/telemetry-events";
import { EventQueue } from "@shared/telemetry/EventQueue";
import { EventAggregator } from "@shared/telemetry/EventAggregator";

describe("EventAggregator", () => {
  const aggregator = new EventAggregator();

  test("aggregates duplicate events", () => {
    const queue = new EventQueue<EvaluatedConfigEvent<string>>();
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

  describe("of evaluations that carry a rule, share and variation", () => {
    const treatmentEvaluation = (servedBy: {
      ruleId: string;
      shareId: string;
      variationId: string;
    }): EvaluatedConfigEvent<string> => ({
      key: "checkout-cta-copy",
      type: "string",
      defaultValue: "in-code default",
      requestedType: "string",
      evaluatedValue: "Try it free",
      usedDefault: false,
      evaluationReason: "found-match",
      ...servedBy,
    });

    test("counts evaluations served by the same rule, share and variation together", () => {
      const queue = new EventQueue<EvaluatedConfigEvent<string>>();
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-1", variationId: "variation-1" }));
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-1", variationId: "variation-1" }));

      const aggregates = aggregator.aggregate(queue.takeSnapshot());

      expect(aggregates).toHaveLength(1);
      expect(aggregates[0]).toMatchObject({
        count: 2,
        event: { ruleId: "rule-1", shareId: "share-1", variationId: "variation-1" },
      });
    });

    test("counts evaluations of one value served by two rules separately", () => {
      const queue = new EventQueue<EvaluatedConfigEvent<string>>();
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-1", variationId: "variation-1" }));
      queue.push(treatmentEvaluation({ ruleId: "rule-2", shareId: "share-1", variationId: "variation-1" }));

      const aggregates = aggregator.aggregate(queue.takeSnapshot());

      expect(aggregates).toHaveLength(2);
      expect(aggregates[0]).toMatchObject({ count: 1, event: { ruleId: "rule-1" } });
      expect(aggregates[1]).toMatchObject({ count: 1, event: { ruleId: "rule-2" } });
    });

    test("counts evaluations of one value served by two shares separately", () => {
      const queue = new EventQueue<EvaluatedConfigEvent<string>>();
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-1", variationId: "variation-1" }));
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-2", variationId: "variation-1" }));

      const aggregates = aggregator.aggregate(queue.takeSnapshot());

      expect(aggregates).toHaveLength(2);
      expect(aggregates[0]).toMatchObject({ count: 1, event: { shareId: "share-1" } });
      expect(aggregates[1]).toMatchObject({ count: 1, event: { shareId: "share-2" } });
    });

    test("counts evaluations of one value served as two variations separately", () => {
      const queue = new EventQueue<EvaluatedConfigEvent<string>>();
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-1", variationId: "variation-1" }));
      queue.push(treatmentEvaluation({ ruleId: "rule-1", shareId: "share-1", variationId: "variation-2" }));

      const aggregates = aggregator.aggregate(queue.takeSnapshot());

      expect(aggregates).toHaveLength(2);
      expect(aggregates[0]).toMatchObject({ count: 1, event: { variationId: "variation-1" } });
      expect(aggregates[1]).toMatchObject({ count: 1, event: { variationId: "variation-2" } });
    });
  });
});
