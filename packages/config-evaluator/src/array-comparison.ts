import type { Operator } from "./types";
import { isScalar, renderScalar } from "./render";

/**
 * Array membership comparisons.
 *
 * Elements are rendered to text before matching, so a list of numbers matches a target of "1".
 * A value that is not an array — including a comma-separated string — contains nothing, so only
 * the negative operator can be true for it.
 */
export const compareArray = (givenValue: unknown, operator: Operator, targetValues: string[]) => {
  const lowercaseOperator = operator.toLowerCase();
  if (!Array.isArray(givenValue)) {
    return lowercaseOperator === "does not contain any of";
  }

  // Nested arrays, objects, and nulls have no text form, so they are dropped rather than matching
  // an empty target value.
  const elements = givenValue.filter(isScalar).map(renderScalar);

  switch (lowercaseOperator) {
    case "contains any of":
      return elements.some((element) => targetValues.includes(element));
    case "does not contain any of":
      return !elements.some((element) => targetValues.includes(element));
    default:
      return false;
  }
};
