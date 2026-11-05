import { describe, test, expect } from "vitest";
import type { ConditionalRule, Config, Rule } from "../src/types";
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

    test("a rule with no conditions applies to every context", () => {
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

      expect(evaluator.evaluate(config, { context: { id: "10" } }).value).toEqual("Rule A Value");
      expect(evaluator.evaluate(config).value).toEqual("Rule A Value");
    });

    describe("a rule with several conditions", () => {
      const identifierIs = (value: string) => ({
        id: crypto.randomUUID(),
        attribute: "identifier",
        operator: "=" as const,
        trait: undefined,
        targetType: "text" as const,
        targetValues: [value],
      });
      const planIs = (value: string) => ({
        id: crypto.randomUUID(),
        attribute: "traits",
        operator: "=" as const,
        trait: "/plan",
        targetType: "text" as const,
        targetValues: [value],
      });
      const configRequiring = (...conditions: ConditionalRule["conditions"]): Config => ({
        id: CONFIG_ID,
        key: "config-with-a-two-condition-rule",
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
              conditions,
            },
          ],
        },
      });
      const config = configRequiring(identifierIs("10"), planIs("pro"));

      test("matches when every condition matches", () => {
        const value = evaluator.evaluate(config, { context: { id: "10", traits: { plan: "pro" } } }).value;
        expect(value).toEqual("Rule A Value");
      });

      test("does not match when only the first condition matches", () => {
        const value = evaluator.evaluate(config, { context: { id: "10", traits: { plan: "free" } } }).value;
        expect(value).toEqual("this-is-the-default");
      });

      test("does not match when only the second condition matches", () => {
        const value = evaluator.evaluate(config, { context: { id: "20", traits: { plan: "pro" } } }).value;
        expect(value).toEqual("this-is-the-default");
      });

      test("does not match when no condition matches", () => {
        const value = evaluator.evaluate(config, { context: { id: "20", traits: { plan: "free" } } }).value;
        expect(value).toEqual("this-is-the-default");
      });

      test("never matches when its conditions cannot all hold", () => {
        const contradiction = configRequiring(identifierIs("10"), identifierIs("20"));

        expect(evaluator.evaluate(contradiction, { context: { id: "10" } }).value).toEqual(
          "this-is-the-default",
        );
        expect(evaluator.evaluate(contradiction, { context: { id: "20" } }).value).toEqual(
          "this-is-the-default",
        );
      });
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
    test("serves the default targeting rule value for a percentage rule when no context is provided", () => {
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

      expect(evaluator.evaluate(config).value).toEqual("this-is-the-default");
    });

    test("serves the default targeting rule value for a percentage rule to a context without an identifier", () => {
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
                { value: "first", percentage: 50, id: crypto.randomUUID() },
                { value: "second", percentage: 50, id: crypto.randomUUID() },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: {} }).value).toEqual("this-is-the-default");
    });
  });

  describe("context kinds", () => {
    const config: Config = {
      id: CONFIG_ID,
      key: "config-with-ten-equal-shares",
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
              { value: "0", percentage: 10, id: crypto.randomUUID() },
              { value: "1", percentage: 10, id: crypto.randomUUID() },
              { value: "2", percentage: 10, id: crypto.randomUUID() },
              { value: "3", percentage: 10, id: crypto.randomUUID() },
              { value: "4", percentage: 10, id: crypto.randomUUID() },
              { value: "5", percentage: 10, id: crypto.randomUUID() },
              { value: "6", percentage: 10, id: crypto.randomUUID() },
              { value: "7", percentage: 10, id: crypto.randomUUID() },
              { value: "8", percentage: 10, id: crypto.randomUUID() },
              { value: "9", percentage: 10, id: crypto.randomUUID() },
            ],
          },
        ],
      },
    };

    test("assigns a context without a kind the share its identifier and the config id hash to", () => {
      expect(evaluator.evaluate(config, { context: { id: "user-1" } }).value).toEqual("0");
    });

    test("assigns a user context the same share as a context without a kind", () => {
      expect(evaluator.evaluate(config, { context: { id: "user-1", kind: "user" } }).value).toEqual("0");
    });

    test("assigns a device context the share its identifier and kind hash to", () => {
      expect(evaluator.evaluate(config, { context: { id: "user-1", kind: "device" } }).value).toEqual("5");
    });

    test("serves a device context without an identifier the default targeting rule value", () => {
      expect(evaluator.evaluate(config, { context: { kind: "device" } }).value).toEqual(
        "this-is-the-default",
      );
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

  describe("value IDs", () => {
    test("serves a rule value with the rule's value ID", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        variations: [],
        target: {
          defaultValue: "hello",
          defaultValueId: "value-id-hello",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "bonjour",
              valueId: "value-id-bonjour",
              percentages: [],
              conditions: [],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } })).toEqual({
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        value: "bonjour",
        valueId: "value-id-bonjour",
      });
    });

    test("serves the default targeting rule value with the config's default value ID", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        variations: [],
        target: {
          defaultValue: "hello",
          defaultValueId: "value-id-hello",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "bonjour",
              valueId: "value-id-bonjour",
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

      expect(evaluator.evaluate(config, { context: { id: "20" } })).toEqual({
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        value: "hello",
        valueId: "value-id-hello",
      });
    });

    test("serves a rollout share with the share's value ID", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        variations: [],
        target: {
          defaultValue: "hello",
          defaultValueId: "value-id-hello",
          rules: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              order: 0,
              type: "percentage",
              target: "percentage",
              percentages: [
                {
                  id: "66666666-6666-4666-8666-666666666666",
                  percentage: 100,
                  value: "hola",
                  valueId: "value-id-hola",
                },
              ],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } })).toEqual({
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        value: "hola",
        valueId: "value-id-hola",
        ruleId: "22222222-2222-4222-8222-222222222222",
        shareId: "66666666-6666-4666-8666-666666666666",
      });
    });

    test("serves a value with no value ID when the config carries none", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        variations: [],
        target: {
          defaultValue: "hello",
          rules: [
            {
              id: crypto.randomUUID(),
              order: 0,
              type: "conditional",
              target: "value",
              value: "bonjour",
              percentages: [],
              conditions: [],
            },
          ],
        },
      };

      expect(evaluator.evaluate(config, { context: { id: "10" } })).toEqual({
        id: CONFIG_ID,
        key: "greeting",
        type: "string",
        value: "bonjour",
        valueId: undefined,
      });
    });
  });

  describe("variations", () => {
    const ROLLOUT_RULE = "22222222-2222-4222-8222-222222222222";
    const TREATMENT_SHARE = "66666666-6666-4666-8666-666666666666";
    const CONTROL = { id: "77777777-7777-4777-8777-777777777777", name: "control", value: "Start free trial" };
    const TREATMENT = { id: "88888888-8888-4888-8888-888888888888", name: "treatment", value: "Try it free" };

    const experimentWith = (...rules: Rule[]): Config => ({
      id: CONFIG_ID,
      key: "checkout-cta-copy",
      type: "string",
      variations: [CONTROL, TREATMENT],
      target: {
        defaultValue: CONTROL.value,
        defaultValueId: "value-id-control",
        defaultVariationId: CONTROL.id,
        rules,
      },
    });

    const treatmentRollout: Rule = {
      id: ROLLOUT_RULE,
      order: 0,
      type: "percentage",
      target: "percentage",
      percentages: [
        {
          id: TREATMENT_SHARE,
          percentage: 100,
          value: TREATMENT.value,
          valueId: "value-id-treatment",
          variationId: TREATMENT.id,
        },
      ],
    };

    test("serves a rollout share with its variation and the rule and share that served it", () => {
      const config = experimentWith(treatmentRollout);

      expect(evaluator.evaluate(config, { context: { id: "10" } })).toEqual({
        id: CONFIG_ID,
        key: "checkout-cta-copy",
        type: "string",
        value: "Try it free",
        valueId: "value-id-treatment",
        variation: { id: TREATMENT.id, name: "treatment" },
        ruleId: ROLLOUT_RULE,
        shareId: TREATMENT_SHARE,
      });
    });

    test("serves a conditional rule's value with its variation and no rule or share", () => {
      const config = experimentWith({
        id: crypto.randomUUID(),
        order: 0,
        type: "conditional",
        target: "value",
        value: TREATMENT.value,
        valueId: "value-id-treatment",
        variationId: TREATMENT.id,
        percentages: [],
        conditions: [],
      });

      const configState = evaluator.evaluate(config, { context: { id: "10" } });

      expect(configState.variation).toEqual({ id: TREATMENT.id, name: "treatment" });
      expect(configState).not.toHaveProperty("ruleId");
      expect(configState).not.toHaveProperty("shareId");
    });

    test("serves the default targeting rule value with its variation and no rule or share", () => {
      const config = experimentWith();

      const configState = evaluator.evaluate(config, { context: { id: "10" } });

      expect(configState.value).toEqual("Start free trial");
      expect(configState.variation).toEqual({ id: CONTROL.id, name: "control" });
      expect(configState).not.toHaveProperty("ruleId");
      expect(configState).not.toHaveProperty("shareId");
    });

    test("serves a context without an identifier that reaches a rollout the default targeting rule value's variation and no rule or share", () => {
      const config = experimentWith(treatmentRollout);

      const configState = evaluator.evaluate(config, { context: { name: "Anonymous visitor" } });

      expect(configState.value).toEqual("Start free trial");
      expect(configState.valueId).toEqual("value-id-control");
      expect(configState.variation).toEqual({ id: CONTROL.id, name: "control" });
      expect(configState).not.toHaveProperty("ruleId");
      expect(configState).not.toHaveProperty("shareId");
    });

    test("explains a served variation by its id", () => {
      const config = experimentWith(treatmentRollout);

      const explanation = evaluator.explain(config, { context: { id: "10" } });

      expect(explanation.variationId).toEqual(TREATMENT.id);
    });

    test("serves a flag's value with no variation", () => {
      const config: Config = {
        id: CONFIG_ID,
        key: "new-checkout",
        type: "boolean",
        variations: [],
        target: { defaultValue: "true", defaultValueId: "value-id-true", rules: [] },
      };

      const configState = evaluator.evaluate(config, { context: { id: "10" } });

      expect(configState.value).toEqual("true");
      expect(configState.variation).toBeUndefined();
    });

    test("serves a value with no variation when the config's variations do not hold its variation id", () => {
      const config: Config = { ...experimentWith(), variations: [TREATMENT] };

      const configState = evaluator.evaluate(config, { context: { id: "10" } });

      expect(configState.value).toEqual("Start free trial");
      expect(configState.variation).toBeUndefined();
    });

    test("serves an unnamed variation with its id and no name", () => {
      const unnamed = { id: "99999999-9999-4999-8999-999999999999", name: null, value: "Get started" };
      const config: Config = {
        ...experimentWith(),
        variations: [CONTROL, unnamed],
        target: {
          defaultValue: unnamed.value,
          defaultValueId: "value-id-get-started",
          defaultVariationId: unnamed.id,
          rules: [],
        },
      };

      const configState = evaluator.evaluate(config, { context: { id: "10" } });

      expect(configState.variation).toEqual({ id: unnamed.id, name: null });
    });
  });

  describe("server payload fields the evaluator does not read", () => {
    const serverPayload = JSON.parse(`{
      "payloadVersion": 1,
      "kind": "full",
      "environmentId": "10000000-0000-0000-0000-000000000000",
      "projectId": "20000000-0000-0000-0000-000000000000",
      "configs": {
        "greeting": {
          "id": "${CONFIG_ID}",
          "key": "greeting",
          "type": "string",
          "variations": [],
          "target": {
            "environmentId": "10000000-0000-0000-0000-000000000000",
            "defaultValue": "hello",
            "defaultValueId": "value-id-1",
            "rules": [
              {
                "id": "33333333-3333-4333-8333-333333333333",
                "order": 0,
                "type": "conditional",
                "target": "value",
                "value": "bonjour",
                "valueId": "value-id-2",
                "conditions": [
                  {
                    "id": "44444444-4444-4444-8444-444444444444",
                    "kind": "attribute",
                    "attribute": "identifier",
                    "trait": null,
                    "operator": "=",
                    "targetType": "text",
                    "targetValues": ["10"]
                  },
                  {
                    "id": "55555555-5555-4555-8555-555555555555",
                    "kind": "attribute",
                    "attribute": "traits",
                    "trait": "/plan",
                    "operator": "is one of",
                    "targetType": "text",
                    "targetValues": ["pro", "enterprise"]
                  }
                ]
              }
            ]
          }
        }
      }
    }`);

    test("evaluates a config whose conditions carry kind and whose set carries payloadVersion as before", () => {
      const config: Config = serverPayload.configs.greeting;

      const matched = evaluator.explain(config, { context: { id: "10", traits: { plan: "pro" } } });
      expect(matched.value).toEqual("bonjour");
      expect(matched.servedBy).toEqual({ kind: "rule", ruleId: "33333333-3333-4333-8333-333333333333" });

      const unmatched = evaluator.explain(config, { context: { id: "10", traits: { plan: "free" } } });
      expect(unmatched.value).toEqual("hello");
      expect(unmatched.servedBy).toEqual({ kind: "default" });
    });
  });

  describe("server payload of an experiment", () => {
    const experiment: Config = JSON.parse(`{
      "id": "${CONFIG_ID}",
      "key": "checkout-cta-copy",
      "type": "string",
      "variations": [
        { "id": "77777777-7777-4777-8777-777777777777", "name": "control", "value": "Start free trial" },
        { "id": "88888888-8888-4888-8888-888888888888", "name": "treatment", "value": "Try it free" },
        { "id": "99999999-9999-4999-8999-999999999999", "name": null, "value": "Get started" }
      ],
      "target": {
        "environmentId": "10000000-0000-0000-0000-000000000000",
        "defaultValue": "Start free trial",
        "defaultValueId": "value-id-control",
        "defaultVariationId": "77777777-7777-4777-8777-777777777777",
        "rules": [
          {
            "id": "33333333-3333-4333-8333-333333333333",
            "order": 0,
            "type": "conditional",
            "target": "value",
            "value": "Get started",
            "valueId": "value-id-get-started",
            "variationId": "99999999-9999-4999-8999-999999999999",
            "conditions": [
              {
                "id": "44444444-4444-4444-8444-444444444444",
                "kind": "attribute",
                "attribute": "traits",
                "trait": "/plan",
                "operator": "is one of",
                "targetType": "text",
                "targetValues": ["enterprise"]
              }
            ]
          },
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "order": 1,
            "type": "percentage",
            "target": "percentage",
            "percentages": [
              {
                "id": "66666666-6666-4666-8666-666666666666",
                "percentage": 100,
                "value": "Try it free",
                "valueId": "value-id-treatment",
                "variationId": "88888888-8888-4888-8888-888888888888"
              }
            ]
          }
        ]
      }
    }`);

    test("serves a rollout share as the entry the SDK server sends client SDKs", () => {
      const configState = evaluator.evaluate(experiment, { context: { id: "10", traits: { plan: "pro" } } });

      expect(JSON.parse(JSON.stringify(configState))).toEqual({
        id: CONFIG_ID,
        key: "checkout-cta-copy",
        type: "string",
        value: "Try it free",
        valueId: "value-id-treatment",
        variation: { id: "88888888-8888-4888-8888-888888888888", name: "treatment" },
        ruleId: "22222222-2222-4222-8222-222222222222",
        shareId: "66666666-6666-4666-8666-666666666666",
      });
    });

    test("serves a conditional rule's unnamed variation with a null name and no rule or share", () => {
      const configState = evaluator.evaluate(experiment, {
        context: { id: "10", traits: { plan: "enterprise" } },
      });

      expect(JSON.parse(JSON.stringify(configState))).toEqual({
        id: CONFIG_ID,
        key: "checkout-cta-copy",
        type: "string",
        value: "Get started",
        valueId: "value-id-get-started",
        variation: { id: "99999999-9999-4999-8999-999999999999", name: null },
      });
    });

    test("serves a context without an identifier the default targeting rule value's variation", () => {
      const configState = evaluator.evaluate(experiment, { context: { traits: { plan: "pro" } } });

      expect(JSON.parse(JSON.stringify(configState))).toEqual({
        id: CONFIG_ID,
        key: "checkout-cta-copy",
        type: "string",
        value: "Start free trial",
        valueId: "value-id-control",
        variation: { id: "77777777-7777-4777-8777-777777777777", name: "control" },
      });
    });
  });
});
