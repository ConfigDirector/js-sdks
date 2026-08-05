import type { Operator } from "./types";

// Strict: no surrounding whitespace, no trailing characters. "26abc" and " 42 " are not numbers.
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Numeric comparisons.
 *
 * A value that is not a finite number — the wrong JSON type, unparseable text, or an infinity —
 * makes every operator false except `!=`, which is true. It does not throw: a rule that targets a
 * numeric trait some users do not have should skip those users, not be discarded.
 */
export const compareNumeric = (givenValue: unknown, operator: Operator, targetValues: string[]) => {
  const lowercaseOperator = operator.toLowerCase();

  const value = parseFinite(givenValue);
  if (value === undefined) {
    return lowercaseOperator === "!=" || lowercaseOperator === "does not equal";
  }

  const first: string | undefined = targetValues[0];
  if (first === undefined) {
    return false;
  }
  const target = parseFinite(first);
  if (target === undefined) {
    return false;
  }

  switch (lowercaseOperator) {
    case "=":
    case "equals":
      return value === target;
    case "!=":
    case "does not equal":
      return value !== target;
    case "<":
      return value < target;
    case "<=":
      return value <= target;
    case ">":
      return value > target;
    case ">=":
      return value >= target;
    default:
      return false;
  }
};

const parseFinite = (value: unknown): number | undefined => {
  // Booleans are not numbers here, even though JavaScript would happily coerce them.
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || !NUMBER.test(value)) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
