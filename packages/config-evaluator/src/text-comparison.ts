import type { Operator } from "./types";

/**
 * Text comparisons.
 *
 * `value` is always a string: an absent attribute has already been rendered to "".
 *
 * An empty `targetValues` makes the single-target operators false — there is nothing to compare
 * against — while the "any of" operators fall out naturally, so "is NOT one of nothing" is true.
 */
export const compareText = (value: string, operator: Operator, targetValues: string[]) => {
  const first: string | undefined = targetValues[0];

  switch (operator.toLowerCase()) {
    case "=":
    case "equals":
      return first !== undefined && value === first;
    case "!=":
    case "does not equal":
      return first !== undefined && value !== first;
    case "is one of":
      return targetValues.includes(value);
    case "is not one of":
      return !targetValues.includes(value);
    case "starts with any of":
      return targetValues.some((target) => value.startsWith(target));
    case "does not start with any of":
      return !targetValues.some((target) => value.startsWith(target));
    case "ends with any of":
      return targetValues.some((target) => value.endsWith(target));
    case "does not end with any of":
      return !targetValues.some((target) => value.endsWith(target));
    default:
      return false;
  }
};
