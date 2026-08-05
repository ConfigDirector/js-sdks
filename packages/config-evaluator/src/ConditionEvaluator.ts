import type { Condition, EvaluationContext } from "./types";
import { findByPointer } from "@jsonjoy.com/json-pointer";
import { compareText } from "./text-comparison";
import { compareNumeric } from "./numeric-comparison";
import { compareDate } from "./date-comparison";
import { compareSemver } from "./semver-comparison";
import { compareArray } from "./array-comparison";
import { ABSENT, UNKNOWN_ATTRIBUTE, render, unwrap, type Resolved } from "./render";

export class ConditionEvaluator {
  /**
   * Decide whether a condition holds for a context.
   *
   *
   * An attribute the context does not carry is not an error: it resolves to the empty string, so
   * a condition can still match or not match on its own terms.
   */
  public evaluate(condition: Condition, context?: EvaluationContext): boolean {
    const value = this.resolve(condition, context);
    if (value === UNKNOWN_ATTRIBUTE) {
      return false;
    }

    const targetValues = condition.targetValues ?? [];

    switch (condition.targetType) {
      case "text":
        return compareText(render(value), condition.operator, targetValues);
      case "number":
        return compareNumeric(unwrap(value), condition.operator, targetValues);
      case "datetime":
        return compareDate(render(value), condition.operator, targetValues);
      case "semver":
        return compareSemver(render(value), condition.operator, targetValues);
      case "array":
        return compareArray(unwrap(value), condition.operator, targetValues);
    }

    return false;
  }

  /** The raw value a condition targets, or one of the two sentinels. */
  private resolve(condition: Condition, context?: EvaluationContext): Resolved {
    switch (condition.attribute) {
      case "identifier":
        return orAbsent(context?.context?.id);
      case "name":
        return orAbsent(context?.context?.name);
      case "appName":
        return orAbsent(context?.metadata?.appName);
      case "appVersion":
        return orAbsent(context?.metadata?.appVersion);
      case "traits":
        if (!condition.trait) {
          return ABSENT;
        }
        return orAbsent(this.findTraitValue(context?.context?.traits, condition.trait));
      default:
        return UNKNOWN_ATTRIBUTE;
    }
  }

  private findTraitValue(traits: Record<string, unknown> | undefined, path: string) {
    try {
      return findByPointer(path, traits).val;
    } catch {
      return undefined;
    }
  }
}

const orAbsent = (value: unknown): Resolved => (value === undefined || value === null ? ABSENT : value);
