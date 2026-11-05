import { ConditionEvaluator } from "./ConditionEvaluator";
import { SegmentEvaluator } from "./SegmentEvaluator";
import { assignPercentage } from "./percent-hashing";
import { effectiveContextKind } from "./context-kind";
import type {
  Condition,
  ConditionExplanation,
  ConditionalRule,
  Config,
  EvaluationContext,
  ConfigState,
  Percentage,
  Rule,
  ConfigDirectorLogger,
  EvaluationExplanation,
  RolloutShare,
  RuleExplanation,
  RuleOutcome,
  Segments,
  ServingReason,
  Share,
} from "./types";

type ServedValue = {
  value: string;
  valueId: string | undefined;
  variationId: string | undefined;
  rolloutShare: RolloutShare | undefined;
};

type RuleServing =
  | { kind: "served"; ruleId: string; servedValue: ServedValue }
  | { kind: "not-matched" }
  | { kind: "rollout-skipped-no-identifier" };

const NOT_MATCHED: RuleServing = { kind: "not-matched" };

const outcomeByServingKind: { [K in RuleServing["kind"]]: RuleOutcome } = {
  served: "matched",
  "not-matched": "not-matched",
  "rollout-skipped-no-identifier": "rollout-skipped-no-identifier",
};

type WalkedRule = {
  explanation: RuleExplanation;
  serving: RuleServing;
};

const servedVariation = (config: Config, variationId: string | undefined): ConfigState["variation"] => {
  if (variationId === undefined) {
    return undefined;
  }
  const variation = (config.variations ?? []).find((candidate) => candidate.id === variationId);
  return variation ? { id: variationId, name: variation.name } : undefined;
};

const servedConfigState = (config: Config, explanation: EvaluationExplanation): ConfigState => ({
  id: config.id,
  key: config.key,
  type: config.type,
  value: explanation.value,
  valueId: explanation.valueId,
  variation: servedVariation(config, explanation.variationId),
  ...explanation.rolloutShare,
});

export class ConfigEvaluator {
  private readonly conditionEvaluator = new ConditionEvaluator();
  private readonly segmentEvaluator = new SegmentEvaluator(this.conditionEvaluator);

  constructor(private readonly logger: ConfigDirectorLogger) {
    if (!logger || !logger.warn || !logger.error || !logger.info) {
      throw new TypeError("The provided logger is not a valid 'ConfigDirectorLogger'");
    }

    this.logger = logger;
  }

  public evaluate(config: Config, context?: EvaluationContext, segments?: Segments): ConfigState {
    return servedConfigState(config, this.explain(config, context, segments));
  }

  /**
   * Evaluate a config for a context and record how the value was reached: every rule in the
   * order it was walked with its outcome, the conditions that were checked with what they
   * resolved to, and the share a rollout assigned the context to. A rollout reached by a context
   * without an identifier is skipped: the walk ends there and the default targeting rule value
   * is served with the reason `rollout-skipped-no-identifier`. `evaluate` is this walk with only
   * the value, its value ID, its variation and the rollout share that served it kept, so the two
   * cannot disagree. `segments` is the payload's segments map, which a segment condition looks
   * its segment up in; a segment it does not hold never matches.
   */
  public explain(config: Config, context?: EvaluationContext, segments?: Segments): EvaluationExplanation {
    const rules = [...(config.target?.rules ?? [])].sort(
      (rule, otherRule) =>
        (rule.order ?? Number.MAX_SAFE_INTEGER) - (otherRule.order ?? Number.MAX_SAFE_INTEGER),
    );
    const walkedRules: WalkedRule[] = [];
    for (const rule of rules) {
      const walkedRule = this.explainRule(rule, config, context, segments);
      walkedRules.push(walkedRule);
      if (walkedRule.serving.kind !== "not-matched") {
        break;
      }
    }
    const ruleExplanations: RuleExplanation[] = [
      ...walkedRules.map((walkedRule) => walkedRule.explanation),
      ...rules.slice(walkedRules.length).map(
        (rule): RuleExplanation => ({
          ruleId: rule.id,
          outcome: "not-evaluated",
          conditions: [],
          bucket: undefined,
        }),
      ),
    ];
    const defaultTargetingRuleValue = (reason: ServingReason): EvaluationExplanation => ({
      value: config.target?.defaultValue,
      valueId: config.target?.defaultValueId,
      variationId: config.target?.defaultVariationId,
      rolloutShare: undefined,
      reason,
      servedBy: { kind: "default" },
      rules: ruleExplanations,
    });

    const lastServing = walkedRules[walkedRules.length - 1]?.serving ?? NOT_MATCHED;
    switch (lastServing.kind) {
      case "served":
        return {
          ...lastServing.servedValue,
          reason: "found-match",
          servedBy: { kind: "rule", ruleId: lastServing.ruleId },
          rules: ruleExplanations,
        };
      case "rollout-skipped-no-identifier":
        return defaultTargetingRuleValue("rollout-skipped-no-identifier");
      case "not-matched":
        return defaultTargetingRuleValue("found-match");
    }
  }

  private explainRule(
    rule: Rule,
    config: Config,
    context: EvaluationContext | undefined,
    segments: Segments | undefined,
  ): WalkedRule {
    const explanation: RuleExplanation = {
      ruleId: rule.id,
      outcome: "not-matched",
      conditions: [],
      bucket: undefined,
    };
    try {
      let serving = NOT_MATCHED;
      if (rule.type == "percentage") {
        serving = this.explainRollout(rule, config, context, explanation);
      } else if (rule.type == "conditional") {
        serving = this.explainConditionalRule(rule, config, context, segments, explanation);
      }
      explanation.outcome = outcomeByServingKind[serving.kind];
      return { explanation, serving };
    } catch (error) {
      this.logger.warn(
        `There was an error while evaluating a targeting rule '${rule?.id}' for '${config?.key}'. The rule will be disregarded.`,
        {
          error,
          configKey: config?.key,
          ruleId: rule?.id,
        },
      );
      return {
        explanation: { ruleId: rule.id, outcome: "errored", conditions: [], bucket: undefined },
        serving: NOT_MATCHED,
      };
    }
  }

  private explainRollout(
    rule: Rule,
    config: Config,
    context: EvaluationContext | undefined,
    explanation: RuleExplanation,
  ): RuleServing {
    if (rule.percentages == null) {
      return NOT_MATCHED;
    }
    const identifier = context?.context?.id ?? undefined;
    if (identifier === undefined) {
      return { kind: "rollout-skipped-no-identifier" };
    }
    const assignedPercentage = assignPercentage({
      configId: config.id,
      contextIdentifier: identifier,
      contextKind: effectiveContextKind(context),
    });
    const shares: Share[] = [];
    let shareStart = 0.0;
    let selectedPercentage: Percentage | undefined = undefined;
    // A bucket spans [shareStart, shareEnd). Strict, so a context landing exactly on a boundary
    // belongs to the bucket that starts there -- which is what keeps a 0% bucket unreachable and
    // each bucket's share exact. See SEMANTICS.md §7.1 in targeting-rules-contract.
    for (const percentage of rule.percentages) {
      const shareEnd = shareStart + percentage.percentage;
      shares.push({
        percentageId: percentage.id,
        from: shareStart,
        to: shareEnd,
        value: percentage.value?.toString(),
      });
      if (selectedPercentage === undefined && assignedPercentage < shareEnd) {
        selectedPercentage = percentage;
      }
      shareStart = shareEnd;
    }

    explanation.bucket = {
      identifier,
      assignedPercentage,
      shares,
      selectedPercentageId: selectedPercentage?.id,
    };
    if (selectedPercentage?.value == null) {
      return NOT_MATCHED;
    }
    return {
      kind: "served",
      ruleId: rule.id,
      servedValue: {
        value: selectedPercentage.value.toString(),
        valueId: selectedPercentage.valueId,
        variationId: selectedPercentage.variationId,
        rolloutShare: { ruleId: rule.id, shareId: selectedPercentage.id },
      },
    };
  }

  private explainConditionalRule(
    rule: ConditionalRule,
    config: Config,
    context: EvaluationContext | undefined,
    segments: Segments | undefined,
    explanation: RuleExplanation,
  ): RuleServing {
    let aConditionDidNotMatch = false;
    for (const condition of rule.conditions ?? []) {
      if (aConditionDidNotMatch) {
        explanation.conditions.push({ conditionId: condition.id, outcome: "not-evaluated" });
        continue;
      }
      const checked = this.explainCondition(condition, context, segments);
      explanation.conditions.push(checked);
      aConditionDidNotMatch = checked.outcome !== "matched";
    }

    if (aConditionDidNotMatch) {
      return NOT_MATCHED;
    }
    if (rule.target == "value") {
      if (rule.value == null) {
        return NOT_MATCHED;
      }
      return {
        kind: "served",
        ruleId: rule.id,
        servedValue: {
          value: rule.value.toString(),
          valueId: rule.valueId,
          variationId: rule.variationId,
          rolloutShare: undefined,
        },
      };
    }
    if (rule.target == "percentage") {
      return this.explainRollout(rule, config, context, explanation);
    }
    return NOT_MATCHED;
  }

  private explainCondition(
    condition: Condition,
    context: EvaluationContext | undefined,
    segments: Segments | undefined,
  ): ConditionExplanation {
    if (condition.kind === "segment") {
      const check = this.segmentEvaluator.explain(condition, segments, context);
      return {
        conditionId: condition.id,
        kind: "segment",
        outcome: check.matched ? "matched" : "not-matched",
        segmentId: condition.segmentId,
        segmentFound: check.segmentFound,
        matchedGroupIndex: check.matchedGroupIndex,
      };
    }
    const check = this.conditionEvaluator.explain(condition, context);
    return {
      conditionId: condition.id,
      kind: "attribute",
      outcome: check.matched ? "matched" : "not-matched",
      resolvedValue: check.resolvedValue,
      resolvedType: check.resolvedType,
    };
  }
}
