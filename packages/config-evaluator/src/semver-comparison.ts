import type { Operator } from "./types";
import * as semver from "semver";

/**
 * Semantic version comparisons.
 *
 * Both sides are coerced first, so partial versions such as `1.0` and `v`-prefixed ones are
 * usable, and any prerelease or build suffix is dropped. A value that cannot be coerced matches
 * nothing, which makes `is NOT one of` the only operator that can be true for it.
 */
export const compareSemver = (value: string, operator: Operator, targetValues: string[]) => {
  const lowercaseOperator = operator.toLowerCase();
  if (value.trim().length === 0) {
    return lowercaseOperator === "is not one of";
  }

  const version = semver.coerce(value);
  const targets = targetValues.map((target) => semver.coerce(target));
  const first: semver.SemVer | null = targets[0] ?? null;

  switch (lowercaseOperator) {
    case "=":
      return equals(version, first);
    case "<":
      return ordered(version, first, semver.lt);
    case "<=":
      return ordered(version, first, semver.lte);
    case ">":
      return ordered(version, first, semver.gt);
    case ">=":
      return ordered(version, first, semver.gte);
    case "is one of":
      return targets.some((target) => equals(version, target));
    case "is not one of":
      return !targets.some((target) => equals(version, target));
    default:
      return false;
  }
};

/** An operand that could not be coerced never compares equal. */
const equals = (value: semver.SemVer | null, target: semver.SemVer | null): boolean =>
  value !== null && target !== null && semver.eq(value, target);

/** An operand that could not be coerced never satisfies an ordering comparison. */
const ordered = (
  value: semver.SemVer | null,
  target: semver.SemVer | null,
  compare: (a: semver.SemVer, b: semver.SemVer) => boolean,
): boolean => value !== null && target !== null && compare(value, target);
