import { describe, test, expect } from "vitest";
import type { Config } from "../src/types";
import { ConfigEvaluator } from "../src/ConfigEvaluator";
import { createStubbedLogger } from "./helpers";

const CONFIG_ID = "11111111-1111-4111-8111-111111111111";

describe("ConfigEvaluator", () => {
  const logger = createStubbedLogger();
  const evaluator = new ConfigEvaluator(logger);

  test("evaluates to the defaultValue in the target when there are no targeting rules", () => {
    const config: Config = {
      id: CONFIG_ID,
      key: "config-without-rules",
      type: "string",
      variations: [],
      target: {
        defaultValue: "this-is-the-default",
        rules: [],
      },
    };

    const configState = evaluator.evaluate(config);
    expect(configState).toMatchObject({
      id: config.id,
      key: config.key,
      type: config.type,
      value: "this-is-the-default",
    });
  });

  describe("percentage rules", () => {
    test("assigns percentages when they add up to 100%", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [
                { value: "Group A", percentage: 50.5, id: crypto.randomUUID() },
                { value: "Group B", percentage: 49.5, id: crypto.randomUUID() },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Group A");
      expect(evaluator.evaluate(config, { context: { id: "15" } }).value).toEqual("Group A");
      expect(evaluator.evaluate(config, { context: { id: "20" } }).value).toEqual("Group B");
    });

    // A bucket spans [start, end), so a 0% bucket is empty and unreachable no matter who asks.
    // With an inclusive boundary it would take one of the 1000 reachable hash values, and a
    // variation turned down to 0% would still serve roughly 0.1% of traffic.
    test("a 0% bucket is unreachable for every identifier", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [
                { value: "never", percentage: 0, id: crypto.randomUUID() },
                { value: "always", percentage: 100, id: crypto.randomUUID() },
              ],
            },
          ],
        },
      };

      for (let i = 0; i < 4000; i++) {
        expect(evaluator.evaluate(config, { context: { id: `user-${i}` } }).value).toEqual("always");
      }
    });

    test("falls back to the default value for some users if the percentages don't add up to 100%", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [
                { value: "Group A", percentage: 20, id: crypto.randomUUID() },
                { value: "Group B", percentage: 30, id: crypto.randomUUID() },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Group A");
      expect(evaluator.evaluate(config, { context: { id: "15" } }).value).toEqual("Group B");
      expect(evaluator.evaluate(config, { context: { id: "80" } }).value).toEqual("this-is-the-default");
    });

    test("falls back to the default if a percentage does not have a value", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [
                { value: "Group A", percentage: 50.5, id: crypto.randomUUID() },
                { value: undefined, percentage: 49.5, id: crypto.randomUUID() },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Group A");
      expect(evaluator.evaluate(config, { context: { id: "15" } }).value).toEqual("Group A");
      expect(evaluator.evaluate(config, { context: { id: "20" } }).value).toEqual("this-is-the-default");
    });
  });

  describe("conditional rules", () => {
    test("evaluates a value based conditional rule", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "Rule A Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Rule A Value");
      expect(evaluator.evaluate(config, { context: { id: "20" } }).value).toEqual("this-is-the-default");
    });

    test("evaluates a percentage based conditional rule", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "percentage",
              value: undefined,
              percentages: [
                { value: "Group A", percentage: 50.5, id: crypto.randomUUID() },
                { value: "Group B", percentage: 49.5, id: crypto.randomUUID() },
              ],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Group A");
      expect(evaluator.evaluate(config, { context: { id: "20" } }).value).toEqual("this-is-the-default");
    });

    test("cycles through multiple rules", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "Rule A Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
            {
              id: crypto.randomUUID(),
              order: 1,
              type: "conditional",
              target: "value",
              value: "Rule B Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["15"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Rule A Value");
      expect(evaluator.evaluate(config, { context: { id: "15" } }).value).toEqual("Rule B Value");
      expect(evaluator.evaluate(config, { context: { id: "20" } }).value).toEqual("this-is-the-default");
    });

    test("falls back to the default when conditions array is empty", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "Rule A Value",
              percentages: [],
              conditions: [],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("this-is-the-default");
    });

    test("matches on the first true condition (OR semantics across multiple conditions)", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "Rule A Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["20"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Rule A Value");
      expect(evaluator.evaluate(config, { context: { id: "20" } }).value).toEqual("Rule A Value");
      expect(evaluator.evaluate(config, { context: { id: "30" } }).value).toEqual("this-is-the-default");
    });

    test("falls back to the default when the condition matches but the value is undefined", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: undefined,
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("this-is-the-default");
    });

    test("falls back to the default when no context is provided and the condition cannot match", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "Rule A Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config).value).toEqual("this-is-the-default");
    });
  });

  describe("rule ordering", () => {
    test("evaluates rules in ascending order by the order attribute regardless of array order", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 1,
              type: "conditional",
              target: "value",
              value: "Rule B Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "Rule A Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      // order 0 rule should win even though it appears second in the array
      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Rule A Value");
    });
  });

  describe("mixed rule types", () => {
    test("evaluates a percentage rule followed by a conditional rule in order", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [{ value: "Percentage Group", percentage: 100, id: crypto.randomUUID() }],
            },
            {
              id: crypto.randomUUID(),
              order: 1,
              type: "conditional",
              target: "value",
              value: "Conditional Value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  trait: undefined,
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      // percentage rule (order 0) always matches at 100%, so the conditional rule (order 1) is never reached
      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Percentage Group");
      expect(evaluator.evaluate(config, { context: { id: "99" } }).value).toEqual("Percentage Group");
    });
  });

  describe("no context", () => {
    test("returns a value for a percentage rule when no context is provided", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [{ value: "Only Group", percentage: 100, id: crypto.randomUUID() }],
            },
          ],
        },
      };

      // with no context, a random UUID is used — at 100% the bucket always matches
      expect(evaluator.evaluate(config).value).toEqual("Only Group");
    });
  });

  describe("unknown rule type", () => {
    test("skips an unknown rule type and falls back to the default value", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "config-without-rules",
        type: "string",
        variations: [],
        target: {
          defaultValue: "this-is-the-default",

          rules: [{ id: crypto.randomUUID(), order: 0, type: "unknown" } as any],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("this-is-the-default");
    });
  });

  describe("resilience to malformed runtime condition data", () => {
    test("does not throw and falls back to default when a text condition has undefined targetValues", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  targetType: "text",

                  targetValues: undefined as any,
                },
              ],
            },
          ],
        },
      };

      expect(() => evaluator.evaluate(config, { context: { id: "10" } })).not.toThrow();
      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("default");
    });

    test("does not throw and falls back to default when a numeric condition has undefined targetValues", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  targetType: "number",

                  targetValues: undefined as any,
                },
              ],
            },
          ],
        },
      };

      expect(() => evaluator.evaluate(config, { context: { id: "10" } })).not.toThrow();
      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("default");
    });

    test("does not throw and falls back to default when a semver condition has undefined targetValues", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "appVersion",
                  operator: ">",
                  targetType: "semver",

                  targetValues: undefined as any,
                },
              ],
            },
          ],
        },
      };

      expect(() =>
        evaluator.evaluate(config, { context: { id: "10" }, metadata: { appVersion: "2.0.0" } }),
      ).not.toThrow();
      expect(
        evaluator.evaluate(config, { context: { id: "10" }, metadata: { appVersion: "2.0.0" } }).value,
      ).toEqual("default");
    });

    test("does not throw and falls back to default when a datetime condition has undefined targetValues", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "traits",
                  trait: "/createdAt",
                  operator: "is after",
                  targetType: "datetime",

                  targetValues: undefined as any,
                },
              ],
            },
          ],
        },
      };

      expect(() =>
        evaluator.evaluate(config, {
          context: { id: "10", traits: { createdAt: "2024-01-01T00:00:00Z" } },
        }),
      ).not.toThrow();
      expect(
        evaluator.evaluate(config, { context: { id: "10", traits: { createdAt: "2024-01-01T00:00:00Z" } } })
          .value,
      ).toEqual("default");
    });

    test("does not throw and falls back to default when an array condition has undefined targetValues", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "traits",
                  trait: "/roles",
                  operator: "contains any of",
                  targetType: "array",

                  targetValues: undefined as any,
                },
              ],
            },
          ],
        },
      };

      expect(() =>
        evaluator.evaluate(config, {
          context: { id: "10", traits: { roles: ["admin", "user"] } },
        }),
      ).not.toThrow();
      expect(
        evaluator.evaluate(config, { context: { id: "10", traits: { roles: ["admin", "user"] } } }).value,
      ).toEqual("default");
    });
  });

  describe("numeric comparison edge cases", () => {
    test("does not throw when a bigint trait value is compared against a decimal targetValue", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "traits",
                  trait: "/score",
                  operator: ">=",
                  targetType: "number",
                  targetValues: ["3.14"],
                },
              ],
            },
          ],
        },
      };

      expect(() =>
        evaluator.evaluate(config, {

          context: { id: "10", traits: { score: 5n as any } },
        }),
      ).not.toThrow();
    });

    test("does not throw when a bigint trait value is compared with an empty targetValues array", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "rule-value",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "traits",
                  trait: "/score",
                  operator: "=",
                  targetType: "number",
                  targetValues: [],
                },
              ],
            },
          ],
        },
      };

      expect(() =>
        evaluator.evaluate(config, {

          context: { id: "10", traits: { score: 5n as any } },
        }),
      ).not.toThrow();
    });
  });

  describe("rule ordering with missing order values", () => {
    test("evaluates rules in a stable, predictable order even when order is undefined on some rules", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "cfg",
        type: "string",
        variations: [],
        target: {
          defaultValue: "default",
          rules: [
            {
              id: crypto.randomUUID(),

              order: undefined as any,
              type: "conditional",
              target: "value",
              value: "first-rule",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "second-rule",
              percentages: [],
              conditions: [
                {
                  id: crypto.randomUUID(),
                  attribute: "identifier",
                  operator: "=",
                  targetType: "text",
                  targetValues: ["10"],
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("second-rule");
    });
  });
});
