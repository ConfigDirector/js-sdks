import { describe, test, expect } from "vitest";
import type { AttributeCondition, Condition, Config, Rule, Segments } from "../src/types";
import { ConfigEvaluator } from "../src/ConfigEvaluator";
import { createStubbedLogger } from "./helpers";

const CONFIG_ID = "11111111-1111-4111-8111-111111111111";
const ACME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BETA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const emailEndsWith = (domain: string): AttributeCondition => ({
  id: crypto.randomUUID(),
  kind: "attribute",
  attribute: "traits",
  trait: "/email",
  operator: "ends with any of",
  targetType: "text",
  targetValues: [domain],
});
const planIs = (plan: string): AttributeCondition => ({
  id: crypto.randomUUID(),
  kind: "attribute",
  attribute: "traits",
  trait: "/plan",
  operator: "equals",
  targetType: "text",
  targetValues: [plan],
});
const inSegment = (segmentId: string, operator: "in" | "not in" = "in"): Condition => ({
  id: crypto.randomUUID(),
  kind: "segment",
  operator,
  segmentId,
});
const ruleServing = (value: string, order: number, ...conditions: Condition[]): Rule => ({
  id: crypto.randomUUID(),
  order,
  type: "conditional",
  target: "value",
  value,
  percentages: [],
  conditions,
});
const configWith = (...rules: Rule[]): Config => ({
  id: CONFIG_ID,
  key: "greeting",
  type: "string",
  variations: [],
  target: { defaultValue: "hello", rules },
});
const acmeMembers: Segments = { [ACME]: { groups: [[emailEndsWith("@acme.com")]] } };

describe("ConfigEvaluator with segments", () => {
  const evaluator = new ConfigEvaluator(createStubbedLogger());

  test("serves a rule whose segment condition holds for a context in the segment", () => {
    const config = configWith(ruleServing("members", 0, inSegment(ACME)));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("members");
  });

  test("falls through a rule whose segment condition does not hold for a context outside the segment", () => {
    const config = configWith(ruleServing("members", 0, inSegment(ACME)));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "bob@other.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("hello");
  });

  test("not in serves a context outside the segment", () => {
    const config = configWith(ruleServing("outsiders", 0, inSegment(ACME, "not in")));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "bob@other.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("outsiders");
  });

  test("not in falls through for a context in the segment", () => {
    const config = configWith(ruleServing("outsiders", 0, inSegment(ACME, "not in")));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("hello");
  });

  test("segment operators are matched case-insensitively", () => {
    const shouting = { ...inSegment(ACME), operator: "IN" } as unknown as Condition;
    const config = configWith(ruleServing("members", 0, shouting));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("members");
  });

  test("a segment absent from the segments map matches nothing for in", () => {
    const config = configWith(ruleServing("members", 0, inSegment(MISSING)));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("hello");
  });

  test("a segment absent from the segments map matches nothing for not in", () => {
    const config = configWith(ruleServing("outsiders", 0, inSegment(MISSING, "not in")));

    const served = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com" } } },
      acmeMembers,
    );

    expect(served.value).toBe("hello");
  });

  test("a segment condition never matches when no segments are given at all", () => {
    const config = configWith(ruleServing("outsiders", 0, inSegment(ACME, "not in")));

    const served = evaluator.evaluate(config, { context: { traits: { email: "bob@other.com" } } });

    expect(served.value).toBe("hello");
  });

  test("a segment condition combines with the rule's attribute conditions by and", () => {
    const config = configWith(ruleServing("pro members", 0, inSegment(ACME), planIs("pro")));

    const proMember = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com", plan: "pro" } } },
      acmeMembers,
    );
    const freeMember = evaluator.evaluate(
      config,
      { context: { traits: { email: "ann@acme.com", plan: "free" } } },
      acmeMembers,
    );
    const proOutsider = evaluator.evaluate(
      config,
      { context: { traits: { email: "bob@other.com", plan: "pro" } } },
      acmeMembers,
    );

    expect(proMember.value).toBe("pro members");
    expect(freeMember.value).toBe("hello");
    expect(proOutsider.value).toBe("hello");
  });

  test("a context is in the segment when any group matches and every condition of that group matches", () => {
    const segments: Segments = {
      [ACME]: { groups: [[emailEndsWith("@acme.com"), planIs("pro")], [emailEndsWith("@beta.com")]] },
    };
    const config = configWith(ruleServing("members", 0, inSegment(ACME)));
    const servedTo = (traits: Record<string, unknown>) =>
      evaluator.evaluate(config, { context: { traits } }, segments).value;

    expect(servedTo({ email: "ann@acme.com", plan: "pro" })).toBe("members");
    expect(servedTo({ email: "ann@acme.com", plan: "free" })).toBe("hello");
    expect(servedTo({ email: "cat@beta.com", plan: "free" })).toBe("members");
    expect(servedTo({ email: "bob@other.com", plan: "pro" })).toBe("hello");
  });

  test("a group condition without a kind is an attribute condition", () => {
    const withoutKind: AttributeCondition = {
      id: crypto.randomUUID(),
      attribute: "traits",
      trait: "/email",
      operator: "ends with any of",
      targetType: "text",
      targetValues: ["@acme.com"],
    };
    const segments: Segments = { [ACME]: { groups: [[withoutKind]] } };
    const config = configWith(ruleServing("members", 0, inSegment(ACME)));

    const served = evaluator.evaluate(config, { context: { traits: { email: "ann@acme.com" } } }, segments);

    expect(served.value).toBe("members");
  });

  test("a group with no conditions matches every context and a segment with no groups matches none", () => {
    const segments: Segments = { [ACME]: { groups: [[]] }, [BETA]: { groups: [] } };
    const everyone = configWith(ruleServing("everyone", 0, inSegment(ACME)));
    const nobody = configWith(ruleServing("nobody", 0, inSegment(BETA)));

    expect(evaluator.evaluate(everyone, { context: { id: "u1" } }, segments).value).toBe("everyone");
    expect(evaluator.evaluate(nobody, { context: { id: "u1" } }, segments).value).toBe("hello");
  });

  test("a segment holding a segment condition inside a group is treated as not found", () => {
    const nested = { ...inSegment(BETA), kind: "segment" } as unknown as AttributeCondition;
    const segments: Segments = { [ACME]: { groups: [[nested], [emailEndsWith("@acme.com")]] } };
    const members = configWith(ruleServing("members", 0, inSegment(ACME)));
    const outsiders = configWith(ruleServing("outsiders", 0, inSegment(ACME, "not in")));

    expect(
      evaluator.evaluate(members, { context: { traits: { email: "ann@acme.com" } } }, segments).value,
    ).toBe("hello");
    expect(
      evaluator.evaluate(outsiders, { context: { traits: { email: "bob@other.com" } } }, segments).value,
    ).toBe("hello");
  });

  test("an absent trait is the empty string inside a group, so a negated condition holds", () => {
    const notFree: AttributeCondition = { ...planIs("free"), operator: "is NOT one of" };
    const segments: Segments = { [ACME]: { groups: [[notFree]] } };
    const config = configWith(ruleServing("not free", 0, inSegment(ACME)));

    const served = evaluator.evaluate(config, { context: { id: "u1" } }, segments);

    expect(served.value).toBe("not free");
  });

  describe("explain", () => {
    test("records which group a matching segment condition matched through", () => {
      const segments: Segments = {
        [ACME]: { groups: [[emailEndsWith("@acme.com")], [emailEndsWith("@beta.com")]] },
      };
      const condition = inSegment(ACME);
      const config = configWith(ruleServing("members", 0, condition));

      const explanation = evaluator.explain(
        config,
        { context: { traits: { email: "cat@beta.com" } } },
        segments,
      );

      expect(explanation.rules[0]?.conditions).toEqual([
        {
          conditionId: condition.id,
          kind: "segment",
          outcome: "matched",
          segmentId: ACME,
          segmentFound: true,
          matchedGroupIndex: 1,
        },
      ]);
    });

    test("records that a not in condition failed because the context is in the segment through a group", () => {
      const condition = inSegment(ACME, "not in");
      const config = configWith(ruleServing("outsiders", 0, condition));

      const explanation = evaluator.explain(
        config,
        { context: { traits: { email: "ann@acme.com" } } },
        acmeMembers,
      );

      expect(explanation.rules[0]?.conditions).toEqual([
        {
          conditionId: condition.id,
          kind: "segment",
          outcome: "not-matched",
          segmentId: ACME,
          segmentFound: true,
          matchedGroupIndex: 0,
        },
      ]);
    });

    test("records that the segment was not found", () => {
      const condition = inSegment(MISSING, "not in");
      const config = configWith(ruleServing("outsiders", 0, condition));

      const explanation = evaluator.explain(
        config,
        { context: { traits: { email: "ann@acme.com" } } },
        acmeMembers,
      );

      expect(explanation.rules[0]?.conditions).toEqual([
        {
          conditionId: condition.id,
          kind: "segment",
          outcome: "not-matched",
          segmentId: MISSING,
          segmentFound: false,
          matchedGroupIndex: undefined,
        },
      ]);
    });

    test("records an attribute condition with its kind", () => {
      const condition = planIs("pro");
      const config = configWith(ruleServing("pro", 0, condition));

      const explanation = evaluator.explain(config, { context: { traits: { plan: "pro" } } });

      expect(explanation.rules[0]?.conditions).toEqual([
        {
          conditionId: condition.id,
          kind: "attribute",
          outcome: "matched",
          resolvedValue: "pro",
          resolvedType: "scalar",
        },
      ]);
    });
  });
});
