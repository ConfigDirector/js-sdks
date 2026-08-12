import { ConditionEvaluator } from "./ConditionEvaluator";
import { assignPercentage } from "./percent-hashing";
import type {
  ConditionalRule,
  Config,
  EvaluationContext,
  ConfigState,
  Percentage,
  PercentageRule,
  Rule,
  ConfigDirectorLogger,
} from "./types";

type RuleSuccess = {
  success: true;
  value: string;
};

type RuleFailure = {
  success: false;
};

type RuleEvaluationResult = RuleSuccess | RuleFailure;

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
      value: this.getConfigValue(config, context),
    };
  }

  private getConfigValue(config: Config, context?: EvaluationContext) {
    const rules = [...(config.target?.rules ?? [])].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    );
    for (const rule of rules) {
      const result = this.evaluateRule(rule, config, context);
      if (result.success) {
        return result.value;
      }
    }
    return config.target?.defaultValue;
  }

  private evaluateRule(rule: Rule, config: Config, context?: EvaluationContext): RuleEvaluationResult {
    try {
      if (rule.type == "percentage") {
        return this.evaluatePercentageRule(rule, config, context);
      } else if (rule.type == "conditional") {
        return this.evaluateConditionalRule(rule, config, context);
      }
    } catch (error) {
      this.logger.warn(`There was an error while evaluating a targeting rule '${rule?.id}' for '${config?.key}'. The rule will be disregarded.`, {
        error,
        configKey: config?.key,
        ruleId: rule?.id,
      });
    }

    return { success: false };
  }

  private evaluatePercentageRule(
    rule: PercentageRule,
    config: Config,
    context?: EvaluationContext,
  ): RuleEvaluationResult {
    return this.evaluatePercentage(rule.percentages ?? [], config, context);
  }

  private evaluatePercentage(
    percentages: Percentage[],
    config: Config,
    context?: EvaluationContext,
  ): RuleEvaluationResult {
    const assignedPercentage = assignPercentage({
      configId: config.id,
      contextIdentifier: context?.context?.id ?? crypto.randomUUID(),
    });
    let sum = 0.0;
    let bucket: Percentage | undefined = undefined;
    for (const percentage of percentages) {
      if (assignedPercentage <= percentage.percentage + sum) {
        bucket = percentage;
        break;
      }

      sum += percentage.percentage;
    }

    if (bucket?.value != null) {
      return { success: true, value: bucket.value.toString() };
    }
    return { success: false };
  }

  private evaluateConditionalRule(
    rule: ConditionalRule,
    config: Config,
    context?: EvaluationContext,
  ): RuleEvaluationResult {
    const condition = (rule.conditions ?? []).find((candidate) =>
      this.conditionEvaluator.evaluate(candidate, context),
    );

    if (condition && rule.target == "value" && rule.value != null) {
      return { success: true, value: rule.value.toString() };
    } else if (condition && rule.target == "percentage") {
      return this.evaluatePercentage(rule.percentages ?? [], config, context);
    }
    return { success: false };
  }
}
