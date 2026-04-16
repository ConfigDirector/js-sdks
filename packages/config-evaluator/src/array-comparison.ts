import type { Operator } from "./types";

export const compareArray = (givenValue: any, operator: Operator, targetValues: string[]) => {
  const lowercaseOperator = operator.toLowerCase();
  if (!Array.isArray(givenValue)) {
    return lowercaseOperator == "does not contain any of";
  }

  switch (lowercaseOperator) {
    case "contains any of":
      return givenValue.some((v) => targetValues.includes(v));
    case "does not contain any of":
      return !givenValue.some((v) => targetValues.includes(v));
    default:
      return false;
  }
};
