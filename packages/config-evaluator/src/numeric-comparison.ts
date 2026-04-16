import type { Operator } from "./types";

export const compareNumeric = (
  givenValue: number | bigint | string | boolean | null | undefined,
  operator: Operator,
  targetValues: string[],
) => {
  if (typeof givenValue == "boolean") {
    return false;
  }
  const lowercaseOperator = operator.toLowerCase();
  if (givenValue == null) {
    return lowercaseOperator == "!=" || lowercaseOperator == "does not equal";
  }

  const { value, target } = parseValueAndTarget(givenValue, targetValues[0]);

  switch (lowercaseOperator) {
    case "=":
    case "equals":
      return value == target;
    case "!=":
    case "does not equal":
      return value != target;
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

const parseValueAndTarget = (value: number | bigint | string, targetValue: string) => {
  if (typeof value == "number") {
    return { value, target: parseAsNumber(targetValue) };
  } else if (typeof value == "bigint") {
    return { value, target: BigInt(targetValue) };
  } else {
    return { value: parseAsNumber(value), target: parseAsNumber(targetValue) };
  }
};

const parseAsNumber = (value: number | bigint | string): number => {
  const n = Number.parseFloat(value.toString());
  if (isNaN(n) || !isFinite(n)) {
    throw new TypeError(`Invalid numeric value: ${value}`);
  }
  return n;
};
