import type { Condition, EvaluationContext } from "./types";
import { findByPointer } from "@jsonjoy.com/json-pointer";
import { compareText } from "./text-comparison";
import { compareNumeric } from "./numeric-comparison";
import { compareDate } from "./date-comparison";
import { compareSemver } from "./semver-comparison";
import { compareArray } from "./array-comparison";

export class ConditionEvaluator {
  public evaluate(condition: Condition, context?: EvaluationContext): boolean {
    if (!this.isConditionValidForComparison(condition)) {
      return false;
    }

    switch (condition.attribute) {
      case "identifier":
        return this.compare(context?.context?.id, condition);
      case "name":
        return this.compare(context?.context?.name, condition);
      case "appName":
        return this.compare(context?.metadata?.appName, condition);
      case "appVersion":
        return this.compare(context?.metadata?.appVersion, condition);
      case "traits":
        if (condition.trait) {
          const value = this.findTraitValue(context?.context?.traits, condition.trait);
          return this.compare(value, condition);
        }
    }

    return false;
  }

  private compare(
    value: any,
    condition: Condition,
  ): boolean {
    switch (condition.targetType) {
      case "text":
        return compareText(value?.toString(), condition.operator, condition.targetValues);
      case "number":
        return compareNumeric(value, condition.operator, condition.targetValues);
      case "datetime":
        return compareDate(value?.toString(), condition.operator, condition.targetValues);
      case "semver":
        return compareSemver(value?.toString(), condition.operator, condition.targetValues);
      case "array":
        return compareArray(value, condition.operator, condition.targetValues);
    }
    return false;
  }

  private findTraitValue(traits: Record<string, unknown> | undefined, path: string) {
    try {
      const reference = findByPointer(path, traits);
      return reference.val;
    } catch {
      return undefined;
    }
  }

  private isConditionValidForComparison(condition: Condition): boolean {
    return Array.isArray(condition.targetValues) && condition.targetValues.length > 0;
  }
}
