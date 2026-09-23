import { describe, test, expect } from "vitest";
import type { Condition, Config, Rule } from "../src/types";
import { ConfigEvaluator } from "../src/ConfigEvaluator";
import { createStubbedLogger } from "./helpers";

const CONFIG_ID = "00000000-0000-0000-0000-000000000001";
const RULE_A = "a0000000-0000-4000-8000-000000000001";
const RULE_B = "b0000000-0000-4000-8000-000000000002";
const CONDITION_PLAN = "c0000000-0000-4000-8000-000000000001";
const CONDITION_VERSION = "c0000000-0000-4000-8000-000000000002";
const SHARE_ENABLED = "d0000000-0000-4000-8000-000000000001";
const SHARE_DISABLED = "d0000000-0000-4000-8000-000000000002";

const planIsOneOf = (...values: string[]): Condition => ({
  id: CONDITION_PLAN,
  attribute: "traits",
  trait: "/plan",
  operator: "is one of",
  targetType: "text",
  targetValues: values,
});
const versionAtLeast = (version: string): Condition => ({
  id: CONDITION_VERSION,
  attribute: "appVersion",
  trait: undefined,
  operator: ">=",
  targetType: "semver",
  targetValues: [version],
});
const conditionalRule = (id: string, order: number, conditions: Condition[], value = "Enabled"): Rule => ({
  id,
  order,
  type: "conditional",
  target: "value",
  value,
  percentages: [],
  conditions,
});
const rolloutRule = (
  id: string,
  order: number,
  percentages: { id: string; percentage: number; value: string }[],
): Rule => ({
  id,
  order,
  type: "percentage",
  target: "percentage",
  percentages,
});
const configWith = (...rules: Rule[]): Config => ({
  id: CONFIG_ID,
  key: "new-checkout-flow",
  type: "boolean",
  variations: [],
  target: { defaultValue: "Disabled", rules },
});

describe("ConfigEvaluator.explain", () => {
  const evaluator = new ConfigEvaluator(createStubbedLogger());

  test("serves the value of the first rule whose conditions all match and stops there", () => {
    const config = configWith(
      conditionalRule(RULE_A, 0, [planIsOneOf("enterprise", "pro"), versionAtLeast("3.2.0")]),
      conditionalRule(RULE_B, 1, [planIsOneOf("free")], "Enabled for free"),
    );

    const explanation = evaluator.explain(config, {
      context: { id: "abc", traits: { plan: "pro" } },
      metadata: { appVersion: "3.4.0" },
    });

    expect(explanation.value).toEqual("Enabled");
    expect(explanation.servedBy).toEqual({ kind: "rule", ruleId: RULE_A });
    expect(explanation.rules).toEqual([
      {
        ruleId: RULE_A,
        outcome: "matched",
        conditions: [
          { conditionId: CONDITION_PLAN, outcome: "matched", resolvedValue: "pro", resolvedType: "scalar" },
          {
            conditionId: CONDITION_VERSION,
            outcome: "matched",
            resolvedValue: "3.4.0",
            resolvedType: "scalar",
          },
        ],
        bucket: undefined,
      },
      { ruleId: RULE_B, outcome: "not-evaluated", conditions: [], bucket: undefined },
    ]);
    expect(
      evaluator.evaluate(config, {
        context: { id: "abc", traits: { plan: "pro" } },
        metadata: { appVersion: "3.4.0" },
      }).value,
    ).toEqual(explanation.value);
  });

  test("stops checking a rule's conditions at the first one that does not match", () => {
    const config = configWith(
      conditionalRule(RULE_A, 0, [planIsOneOf("enterprise", "pro"), versionAtLeast("3.2.0")]),
    );

    const explanation = evaluator.explain(config, {
      context: { id: "abc", traits: { plan: "free" } },
      metadata: { appVersion: "3.4.0" },
    });

    expect(explanation.value).toEqual("Disabled");
    expect(explanation.servedBy).toEqual({ kind: "default" });
    expect(explanation.rules[0]?.outcome).toEqual("not-matched");
    expect(explanation.rules[0]?.conditions).toEqual([
      { conditionId: CONDITION_PLAN, outcome: "not-matched", resolvedValue: "free", resolvedType: "scalar" },
      { conditionId: CONDITION_VERSION, outcome: "not-evaluated" },
    ]);
    expect(
      evaluator.evaluate(config, {
        context: { id: "abc", traits: { plan: "free" } },
        metadata: { appVersion: "3.4.0" },
      }).value,
    ).toEqual("Disabled");
  });

  test("reports an absent attribute as absent and a later failing condition by its resolved value", () => {
    const config = configWith(
      conditionalRule(RULE_A, 0, [planIsOneOf("enterprise", "pro"), versionAtLeast("3.2.0")]),
    );

    const explanation = evaluator.explain(config, {
      context: { id: "abc", traits: { plan: "pro" } },
      metadata: {},
    });

    expect(explanation.rules[0]?.conditions).toEqual([
      { conditionId: CONDITION_PLAN, outcome: "matched", resolvedValue: "pro", resolvedType: "scalar" },
      {
        conditionId: CONDITION_VERSION,
        outcome: "not-matched",
        resolvedValue: undefined,
        resolvedType: "absent",
      },
    ]);
  });

  test("reports the JSON type of a trait that is not a scalar", () => {
    const tagsContainAny: Condition = {
      id: CONDITION_PLAN,
      attribute: "traits",
      trait: "/tags",
      operator: "contains any of",
      targetType: "array",
      targetValues: ["beta"],
    };
    const config = configWith(conditionalRule(RULE_A, 0, [tagsContainAny]));

    const asArray = evaluator.explain(config, { context: { id: "abc", traits: { tags: ["beta", "eu"] } } });
    const asObject = evaluator.explain(config, { context: { id: "abc", traits: { tags: { beta: true } } } });

    expect(asArray.rules[0]?.conditions[0]).toEqual({
      conditionId: CONDITION_PLAN,
      outcome: "matched",
      resolvedValue: ["beta", "eu"],
      resolvedType: "array",
    });
    expect(asObject.rules[0]?.conditions[0]).toEqual({
      conditionId: CONDITION_PLAN,
      outcome: "not-matched",
      resolvedValue: { beta: true },
      resolvedType: "object",
    });
  });

  test("reports an attribute this evaluator does not know as unknown and never matched", () => {
    const unknown: Condition = {
      id: CONDITION_PLAN,
      attribute: "deviceId",
      trait: undefined,
      operator: "equals",
      targetType: "text",
      targetValues: ["abc"],
    };
    const config = configWith(conditionalRule(RULE_A, 0, [unknown]));

    const explanation = evaluator.explain(config, { context: { id: "abc" } });

    expect(explanation.value).toEqual("Disabled");
    expect(explanation.rules[0]?.conditions[0]).toEqual({
      conditionId: CONDITION_PLAN,
      outcome: "not-matched",
      resolvedValue: undefined,
      resolvedType: "unknown-attribute",
    });
  });

  test("explains the share a rollout assigned the context to", () => {
    const config = configWith(
      rolloutRule(RULE_A, 0, [
        { id: SHARE_ENABLED, percentage: 25, value: "Enabled" },
        { id: SHARE_DISABLED, percentage: 50, value: "Disabled by rollout" },
      ]),
    );

    const explanation = evaluator.explain(config, { context: { id: "abc" } });

    expect(explanation.value).toEqual("Disabled by rollout");
    expect(explanation.servedBy).toEqual({ kind: "rule", ruleId: RULE_A });
    expect(explanation.rules[0]).toEqual({
      ruleId: RULE_A,
      outcome: "matched",
      conditions: [],
      bucket: {
        identifier: "abc",
        identifierWasGenerated: false,
        assignedPercentage: 61.8,
        shares: [
          { percentageId: SHARE_ENABLED, from: 0, to: 25, value: "Enabled" },
          { percentageId: SHARE_DISABLED, from: 25, to: 75, value: "Disabled by rollout" },
        ],
        selectedPercentageId: SHARE_DISABLED,
      },
    });
  });

  test("explains a rollout the context falls outside of", () => {
    const config = configWith(
      rolloutRule(RULE_A, 0, [{ id: SHARE_ENABLED, percentage: 25, value: "Enabled" }]),
    );

    const explanation = evaluator.explain(config, { context: { id: "abc" } });

    expect(explanation.value).toEqual("Disabled");
    expect(explanation.servedBy).toEqual({ kind: "default" });
    expect(explanation.rules[0]?.outcome).toEqual("not-matched");
    expect(explanation.rules[0]?.bucket).toEqual({
      identifier: "abc",
      identifierWasGenerated: false,
      assignedPercentage: 61.8,
      shares: [{ percentageId: SHARE_ENABLED, from: 0, to: 25, value: "Enabled" }],
      selectedPercentageId: undefined,
    });
  });

  test("explains the rollout of a conditional rule that targets percentages", () => {
    const rule: Rule = {
      id: RULE_A,
      order: 0,
      type: "conditional",
      target: "percentage",
      value: undefined,
      conditions: [planIsOneOf("pro")],
      percentages: [{ id: SHARE_ENABLED, percentage: 100, value: "Enabled" }],
    };
    const config = configWith(rule);

    const explanation = evaluator.explain(config, { context: { id: "abc", traits: { plan: "pro" } } });

    expect(explanation.value).toEqual("Enabled");
    expect(explanation.rules[0]?.outcome).toEqual("matched");
    expect(explanation.rules[0]?.conditions[0]?.outcome).toEqual("matched");
    expect(explanation.rules[0]?.bucket?.selectedPercentageId).toEqual(SHARE_ENABLED);
  });

  test("says when the rollout identifier was generated for a context without an id", () => {
    const config = configWith(
      rolloutRule(RULE_A, 0, [{ id: SHARE_ENABLED, percentage: 100, value: "Enabled" }]),
    );

    const explanation = evaluator.explain(config, { context: {} });

    expect(explanation.value).toEqual("Enabled");
    expect(explanation.rules[0]?.bucket?.identifierWasGenerated).toBe(true);
    expect(explanation.rules[0]?.bucket?.identifier).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("marks a rule whose evaluation throws as errored and moves on to the next rule", () => {
    const broken: Condition = {
      id: CONDITION_PLAN,
      attribute: "identifier",
      trait: undefined,
      operator: undefined as unknown as Condition["operator"],
      targetType: "text",
      targetValues: ["abc"],
    };
    const config = configWith(
      conditionalRule(RULE_A, 0, [broken]),
      conditionalRule(RULE_B, 1, [planIsOneOf("pro")]),
    );

    const explanation = evaluator.explain(config, { context: { id: "abc", traits: { plan: "pro" } } });

    expect(explanation.value).toEqual("Enabled");
    expect(explanation.servedBy).toEqual({ kind: "rule", ruleId: RULE_B });
    expect(explanation.rules[0]).toEqual({
      ruleId: RULE_A,
      outcome: "errored",
      conditions: [],
      bucket: undefined,
    });
    expect(explanation.rules[1]?.outcome).toEqual("matched");
  });

  test("serves the default targeting rule value when no rule matches", () => {
    const config = configWith(conditionalRule(RULE_A, 0, [planIsOneOf("enterprise")]));

    const explanation = evaluator.explain(config, { context: { id: "abc", traits: { plan: "free" } } });

    expect(explanation).toEqual({
      value: "Disabled",
      servedBy: { kind: "default" },
      rules: [
        {
          ruleId: RULE_A,
          outcome: "not-matched",
          conditions: [
            {
              conditionId: CONDITION_PLAN,
              outcome: "not-matched",
              resolvedValue: "free",
              resolvedType: "scalar",
            },
          ],
          bucket: undefined,
        },
      ],
    });
  });

  test("walks rules in ascending order regardless of the order they are listed", () => {
    const config = configWith(
      conditionalRule(RULE_B, 1, [planIsOneOf("pro")], "second"),
      conditionalRule(RULE_A, 0, [planIsOneOf("pro")], "first"),
    );

    const explanation = evaluator.explain(config, { context: { id: "abc", traits: { plan: "pro" } } });

    expect(explanation.value).toEqual("first");
    expect(explanation.rules.map((rule) => rule.ruleId)).toEqual([RULE_A, RULE_B]);
  });

  test("explains a config with no rules as served by the default", () => {
    const explanation = evaluator.explain(configWith(), { context: { id: "abc" } });

    expect(explanation).toEqual({ value: "Disabled", servedBy: { kind: "default" }, rules: [] });
  });
});
