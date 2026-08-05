import type { Operator } from "./types";

/**
 * Numeric comparisons.
 *
 * A value that is not a finite number, the wrong JSON type, unparseable text, or an infinity,
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

/**
 * Parse strictly: no surrounding whitespace, no trailing characters, decimal notation only.
 * `10`, `10.5`, `-5` and `1e3` parse; `26abc`, ` 42 `, `0x10`, `Infinity` and `""` do not.
 */
const parseFinite = (value: unknown): number | undefined => {
  // Booleans are not numbers here, even though JavaScript would happily coerce them.
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  // Number() would accept surrounding whitespace, `0x10`, `Infinity`, and returns 0 for a blank
  // string. Restricting the characters first rules those out; Number() then validates the
  // grammar, rejecting the likes of `1.2.3` and `1e`. Both steps are a single pass.
  if (!isDecimalCharacters(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isDecimalCharacters = (value: string): boolean => {
  for (const character of value) {
    const isDigit = character >= "0" && character <= "9";
    if (!isDigit && !"+-.eE".includes(character)) {
      return false;
    }
  }
  return true;
};
