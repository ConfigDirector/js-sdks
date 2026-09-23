import { ConditionEvaluator } from "./ConditionEvaluator";
import { assignPercentage } from "./percent-hashing";
import type {
  ConditionalRule,
  Config,
  EvaluationContext,
  ConfigState,
  Percentage,
  Rule,
  ConfigDirectorLogger,
  EvaluationExplanation,
  RuleExplanation,
  Share,
} from "./types";

type RuleResult = {
  explanation: RuleExplanation;
  value: string | undefined;
};

export class ConfigEvaluator {
  private readonly conditionEvaluator = new ConditionEvaluator();

  constructor(private readonly logger: ConfigDirectorLogger) {
    if (!logger || !logger.warn || !logger.error || !logger.info) {
      throw new TypeError("The provided logger is not a valid 'ConfigDirectorLogger'");
    }

    this.logger = logger;
  }

  public evaluate(config: Config, context?: EvaluationContext): ConfigState {
    return {
      id: config.id,
      key: config.key,
      type: config.type,
      value: this.explain(config, context).value,
    };
  }

  /**
   * Evaluate a config for a context and record how the value was reached: every rule in the
   * order it was walked with its outcome, the conditions that were checked with what they
   * resolved to, and the share a rollout assigned the context to. `evaluate` is this walk with
   * only the value kept, so the two cannot disagree.
   */
  public explain(config: Config, context?: EvaluationContext): EvaluationExplanation {
    const rules = [...(config.target?.rules ?? [])].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    );
    const explanations: RuleExplanation[] = [];
    let served: { ruleId: string; value: string } | undefined;
    for (const rule of rules) {
      if (served) {
        explanations.push({ ruleId: rule.id, outcome: "not-evaluated", conditions: [], bucket: undefined });
        continue;
      }
      const result = this.explainRule(rule, config, context);
      explanations.push(result.explanation);
      if (result.value !== undefined) {
        served = { ruleId: rule.id, value: result.value };
      }
    }
    return {
      value: served?.value ?? config.target?.defaultValue,
      servedBy: served ? { kind: "rule", ruleId: served.ruleId } : { kind: "default" },
      rules: explanations,
    };
  }

  private explainRule(rule: Rule, config: Config, context?: EvaluationContext): RuleResult {
    const explanation: RuleExplanation = {
      ruleId: rule.id,
      outcome: "not-matched",
      conditions: [],
      bucket: undefined,
    };
    try {
      let value: string | undefined;
      if (rule.type == "percentage") {
        value = this.explainPercentage(rule.percentages ?? [], config, context, explanation);
      } else if (rule.type == "conditional") {
        value = this.explainConditionalRule(rule, config, context, explanation);
      }
      if (value !== undefined) {
        explanation.outcome = "matched";
      }
      return { explanation, value };
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
        value: undefined,
      };
    }
  }

  private explainPercentage(
    percentages: Percentage[],
    config: Config,
    context: EvaluationContext | undefined,
    explanation: RuleExplanation,
  ): string | undefined {
    const contextIdentifier = context?.context?.id;
    const identifier = contextIdentifier ?? crypto.randomUUID();
    const assignedPercentage = assignPercentage({ configId: config.id, contextIdentifier: identifier });
    const shares: Share[] = [];
    let sum = 0.0;
    let selected: Percentage | undefined = undefined;
    // A bucket spans [sum, sum + percentage). Strict, so a context landing exactly on a boundary
    // belongs to the bucket that starts there -- which is what keeps a 0% bucket unreachable and
    // each bucket's share exact. See SEMANTICS.md §7.1 in targeting-rules-contract.
    for (const percentage of percentages) {
      const to = sum + percentage.percentage;
      shares.push({ percentageId: percentage.id, from: sum, to, value: percentage.value?.toString() });
      if (selected === undefined && assignedPercentage < to) {
        selected = percentage;
      }
      sum = to;
    }

    explanation.bucket = {
      identifier,
      identifierWasGenerated: contextIdentifier == null,
      assignedPercentage,
      shares,
      selectedPercentageId: selected?.id,
    };
    return selected?.value != null ? selected.value.toString() : undefined;
  }

  private explainConditionalRule(
    rule: ConditionalRule,
    config: Config,
    context: EvaluationContext | undefined,
    explanation: RuleExplanation,
  ): string | undefined {
    let failed = false;
    for (const condition of rule.conditions ?? []) {
      if (failed) {
        explanation.conditions.push({ conditionId: condition.id, outcome: "not-evaluated" });
        continue;
      }
      const check = this.conditionEvaluator.explain(condition, context);
      explanation.conditions.push({
        conditionId: condition.id,
        outcome: check.matched ? "matched" : "not-matched",
        resolvedValue: check.resolvedValue,
        resolvedType: check.resolvedType,
      });
      failed = !check.matched;
    }

    if (failed) {
      return undefined;
    }
    if (rule.target == "value") {
      return rule.value != null ? rule.value.toString() : undefined;
    }
    if (rule.target == "percentage") {
      return this.explainPercentage(rule.percentages ?? [], config, context, explanation);
    }
    return undefined;
  }
}
