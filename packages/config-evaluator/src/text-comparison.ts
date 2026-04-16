import type { Operator } from "./types";

export const compareText = (value: string | null | undefined, operator: Operator, targetValues: string[]) => {
  switch (operator.toLowerCase()) {
    case "=":
    case "equals":
      return value == targetValues[0];
    case "!=":
    case "does not equal":
      return value != targetValues[0];
    case "is one of":
      return targetValues.includes(value as any);
    case "is not one of":
      return !targetValues.includes(value as any);
    case "starts with any of":
      return targetValues.findIndex((v) => value?.startsWith(v)) >= 0;
    case "does not start with any of":
      return targetValues.findIndex((v) => value?.startsWith(v)) < 0;
    case "ends with any of":
      return targetValues.findIndex((v) => value?.endsWith(v)) >= 0;
    case "does not end with any of":
      return targetValues.findIndex((v) => value?.endsWith(v)) < 0;
    case "matches regex":
      return matchesRegex(targetValues[0], value);
    case "does not match regex":
      return !matchesRegex(targetValues[0], value);
    default:
      return false;
  }
};

const matchesRegex = (regexString: string, value: string | null | undefined) => {
  try {
    return new RegExp(regexString).test(value as any);
  } catch {
    return false;
  }
};
