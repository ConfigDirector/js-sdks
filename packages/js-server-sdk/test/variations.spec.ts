import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setupServer } from "msw/node";
import { http } from "msw";
import { createClient } from "../src";
import type { ConfigEvaluation } from "../src";
import { createStubbedLogger, SSE_URL, TELEMETRY_URL } from "./helpers";

const buildResponse = (stream: ReadableStream) =>
  new Response(stream, {
    headers: { connection: "keep-alive", "content-type": "text/event-stream", "cache-control": "no-cache" },
  });

const message = (data: unknown) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

type EvaluationEntry = {
  count: number;
  event: { ruleId?: string; shareId?: string; variationId?: string };
};
type TelemetryReport = { aggregatedEvents: { evaluatedConfig: EvaluationEntry[] } };

const CONTROL_ID = "77777777-7777-4777-8777-777777777777";
const TREATMENT_ID = "88888888-8888-4888-8888-888888888888";
const UNNAMED_ID = "99999999-9999-4999-8999-999999999999";
const EMPTY_NAME_ID = "99999999-9999-4999-8999-99999999999a";
const ROLLOUT_RULE_ID = "22222222-2222-4222-8222-222222222222";
const TREATMENT_SHARE_ID = "66666666-6666-4666-8666-666666666666";
const SECOND_TREATMENT_SHARE_ID = "66666666-6666-4666-8666-666666666667";

const planIs = (plan: string) => ({
  id: "44444444-4444-4444-8444-444444444444",
  kind: "attribute",
  attribute: "traits",
  trait: "/plan",
  operator: "is one of",
  targetType: "text",
  targetValues: [plan],
});

const treatmentShare = (id: string, percentage: number) => ({
  id,
  percentage,
  value: "Try it free",
  valueId: "value-id-treatment",
  variationId: TREATMENT_ID,
});

const experimentWithRollout = (...percentages: unknown[]) => ({
  id: "00000000-0000-0000-0000-000000000001",
  key: "checkout-cta-copy",
  type: "string",
  variations: [
    { id: CONTROL_ID, name: "control", value: "Start free trial" },
    { id: TREATMENT_ID, name: "treatment", value: "Try it free" },
    { id: UNNAMED_ID, name: null, value: "Get started" },
    { id: EMPTY_NAME_ID, name: "", value: "Begin" },
  ],
  target: {
    environmentId: "10000000-0000-0000-0000-000000000000",
    defaultValue: "Start free trial",
    defaultValueId: "value-id-control",
    defaultVariationId: CONTROL_ID,
    rules: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        order: 0,
        type: "conditional",
        target: "value",
        value: "Get started",
        valueId: "value-id-get-started",
        variationId: UNNAMED_ID,
        conditions: [planIs("enterprise")],
      },
      {
        id: "33333333-3333-4333-8333-333333333334",
        order: 1,
        type: "conditional",
        target: "value",
        value: "Begin",
        valueId: "value-id-begin",
        variationId: EMPTY_NAME_ID,
        conditions: [planIs("team")],
      },
      {
        id: ROLLOUT_RULE_ID,
        order: 2,
        type: "conditional",
        target: "percentage",
        conditions: [planIs("pro")],
        percentages,
      },
    ],
  },
});

const experiment = experimentWithRollout(treatmentShare(TREATMENT_SHARE_ID, 100));

const flag = {
  id: "00000000-0000-0000-0000-000000000002",
  key: "new-checkout",
  type: "boolean",
  variations: [],
  target: {
    environmentId: "10000000-0000-0000-0000-000000000000",
    defaultValue: "true",
    defaultValueId: "value-id-true",
    rules: [],
  },
};

const server = setupServer();
const logger = createStubbedLogger();

describe("variations", () => {
  let reports: TelemetryReport[];

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    server.resetHandlers();
    reports = [];
    server.use(
      http.post(TELEMETRY_URL, async ({ request }) => {
        reports.push((await request.json()) as TelemetryReport);
        return new Response(null, { status: 204 });
      }),
    );
  });
  afterAll(() => server.close());

  const streaming = (configs: Record<string, unknown>) =>
    server.use(
      http.post(SSE_URL, () =>
        buildResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                message({
                  environmentId: "10000000-0000-0000-0000-000000000000",
                  projectId: "20000000-0000-0000-0000-000000000000",
                  kind: "full",
                  configs,
                }),
              );
            },
          }),
        ),
      ),
    );

  const evaluationEntriesSentOnDispose = async (client: { dispose(): void }): Promise<EvaluationEntry[]> => {
    client.dispose();
    return vi.waitFor(() => {
      const [report] = reports;
      if (!report) {
        throw new Error("No telemetry report was sent yet");
      }
      return report.aggregatedEvents.evaluatedConfig;
    });
  };

  describe("evaluate", () => {
    test("returns the variation of the share a percentage rollout served", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", "in-code default", {
        id: "user-1",
        traits: { plan: "pro" },
      });

      expect(evaluation).toEqual({
        key: "checkout-cta-copy",
        value: "Try it free",
        valueId: "value-id-treatment",
        variation: { id: TREATMENT_ID, name: "treatment" },
        isDefaultValue: false,
        reason: "found-match",
        context: { id: "user-1", traits: { plan: "pro" } },
      });
      client.dispose();
    });

    test("returns the unnamed variation of a conditional rule's value with its id and no name", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", "in-code default", {
        id: "user-1",
        traits: { plan: "enterprise" },
      });

      expect(evaluation.value).toBe("Get started");
      expect(evaluation.variation).toStrictEqual({ id: UNNAMED_ID });
      client.dispose();
    });

    test("returns a variation whose name is empty with its id and no name", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", "in-code default", {
        id: "user-1",
        traits: { plan: "team" },
      });

      expect(evaluation.value).toBe("Begin");
      expect(evaluation.variation).toStrictEqual({ id: EMPTY_NAME_ID });
      client.dispose();
    });

    test("returns the variation of the default targeting rule value", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", "in-code default", {
        id: "user-1",
        traits: { plan: "free" },
      });

      expect(evaluation).toEqual({
        key: "checkout-cta-copy",
        value: "Start free trial",
        valueId: "value-id-control",
        variation: { id: CONTROL_ID, name: "control" },
        isDefaultValue: false,
        reason: "found-match",
        context: { id: "user-1", traits: { plan: "free" } },
      });
      client.dispose();
    });

    test("serves a context without an identifier that reaches a rollout the default targeting rule value with reason 'rollout-skipped-no-identifier'", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", "in-code default", { traits: { plan: "pro" } });

      expect(evaluation).toEqual({
        key: "checkout-cta-copy",
        value: "Start free trial",
        valueId: "value-id-control",
        variation: { id: CONTROL_ID, name: "control" },
        isDefaultValue: false,
        reason: "rollout-skipped-no-identifier",
        context: { traits: { plan: "pro" } },
      });
      client.dispose();
    });

    test("returns no variation for a flag, whose config has no variations", async () => {
      streaming({ "new-checkout": flag });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("new-checkout", false, { id: "user-1" });

      expect(evaluation.value).toBe(true);
      expect(evaluation.variation).toBeUndefined();
      client.dispose();
    });

    test("returns no variation with the in-code default value when the value cannot be read as the requested type", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", 7, { id: "user-1", traits: { plan: "pro" } });

      expect(evaluation.reason).toBe("invalid-number");
      expect(evaluation.value).toBe(7);
      expect(evaluation.variation).toBeUndefined();
      client.dispose();
    });

    test("keeps the reason of the in-code default value for a context without an identifier that reaches a rollout", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const evaluation = client.evaluate("checkout-cta-copy", 7, { traits: { plan: "pro" } });

      expect(evaluation.reason).toBe("invalid-number");
      expect(evaluation.isDefaultValue).toBe(true);
      client.dispose();
    });
  });

  describe("configEvaluated", () => {
    test("carries the variation of the value served", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();
      const evaluations: ConfigEvaluation[] = [];
      client.on("configEvaluated", ({ evaluation }) => evaluations.push(evaluation));

      client.getValue("checkout-cta-copy", "in-code default", { id: "user-1", traits: { plan: "pro" } });

      await vi.waitFor(() => expect(evaluations).toHaveLength(1));
      expect(evaluations[0]?.variation).toEqual({ id: TREATMENT_ID, name: "treatment" });
      client.dispose();
    });
  });

  describe("evaluation events", () => {
    test("report the rule, share and variation of a value a percentage rollout served", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("checkout-cta-copy", "in-code default", { id: "user-1", traits: { plan: "pro" } });

      const entries = await evaluationEntriesSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toMatchObject({
        key: "checkout-cta-copy",
        contextId: "user-1",
        usedDefault: false,
        evaluationReason: "found-match",
        ruleId: ROLLOUT_RULE_ID,
        shareId: TREATMENT_SHARE_ID,
        variationId: TREATMENT_ID,
      });
    });

    test("report the variation and no rule or share for a conditional rule's value", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("checkout-cta-copy", "in-code default", {
        id: "user-1",
        traits: { plan: "enterprise" },
      });

      const entries = await evaluationEntriesSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event.variationId).toBe(UNNAMED_ID);
      expect(entries[0]?.event).not.toHaveProperty("ruleId");
      expect(entries[0]?.event).not.toHaveProperty("shareId");
    });

    test("report a skipped rollout with its reason, the default targeting rule value's variation and no rule or share", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("checkout-cta-copy", "in-code default", { traits: { plan: "pro" } });

      const entries = await evaluationEntriesSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toMatchObject({
        usedDefault: false,
        evaluationReason: "rollout-skipped-no-identifier",
        variationId: CONTROL_ID,
      });
      expect(entries[0]?.event).not.toHaveProperty("ruleId");
      expect(entries[0]?.event).not.toHaveProperty("shareId");
    });

    test("report no rule, share or variation for a flag, whose config has no variations", async () => {
      streaming({ "new-checkout": flag });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("new-checkout", false, { id: "user-1" });

      const entries = await evaluationEntriesSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).not.toHaveProperty("ruleId");
      expect(entries[0]?.event).not.toHaveProperty("shareId");
      expect(entries[0]?.event).not.toHaveProperty("variationId");
    });

    test("report no rule, share or variation when the in-code default value is returned", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      client.getValue("checkout-cta-copy", 7, { id: "user-1", traits: { plan: "pro" } });

      const entries = await evaluationEntriesSentOnDispose(client);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.event).toMatchObject({ usedDefault: true, evaluationReason: "invalid-number" });
      expect(entries[0]?.event).not.toHaveProperty("ruleId");
      expect(entries[0]?.event).not.toHaveProperty("shareId");
      expect(entries[0]?.event).not.toHaveProperty("variationId");
    });

    test("count evaluations of one value served by two shares separately", async () => {
      streaming({
        "checkout-cta-copy": experimentWithRollout(
          treatmentShare(TREATMENT_SHARE_ID, 50),
          treatmentShare(SECOND_TREATMENT_SHARE_ID, 50),
        ),
      });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const anonymousProContext = (id: string) => ({ id, anonymous: true, traits: { plan: "pro" } });

      client.getValue("checkout-cta-copy", "in-code default", anonymousProContext("user-1"));
      client.getValue("checkout-cta-copy", "in-code default", anonymousProContext("user-3"));

      const entries = await evaluationEntriesSentOnDispose(client);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({ count: 1, event: { shareId: TREATMENT_SHARE_ID } });
      expect(entries[1]).toMatchObject({ count: 1, event: { shareId: SECOND_TREATMENT_SHARE_ID } });
    });
  });

  describe("getAllConfigs", () => {
    test("returns the variation, rule and share of a value a percentage rollout served", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const configs = client.getAllConfigs({ context: { id: "user-1", traits: { plan: "pro" } } });

      expect(configs["checkout-cta-copy"]).toEqual({
        id: "00000000-0000-0000-0000-000000000001",
        key: "checkout-cta-copy",
        type: "string",
        value: "Try it free",
        valueId: "value-id-treatment",
        variation: { id: TREATMENT_ID, name: "treatment" },
        ruleId: ROLLOUT_RULE_ID,
        shareId: TREATMENT_SHARE_ID,
      });
      client.dispose();
    });

    test("returns the default targeting rule value's variation and no rule or share for a context without an identifier", async () => {
      streaming({ "checkout-cta-copy": experiment });
      const client = createClient("sdk-key", { logger });
      await client.initialize();

      const configs = client.getAllConfigs({ context: { traits: { plan: "pro" } } });

      expect(configs["checkout-cta-copy"]).toStrictEqual({
        id: "00000000-0000-0000-0000-000000000001",
        key: "checkout-cta-copy",
        type: "string",
        value: "Start free trial",
        valueId: "value-id-control",
        variation: { id: CONTROL_ID, name: "control" },
      });
      client.dispose();
    });
  });
});
