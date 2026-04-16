import type { Operator } from "./types";
import * as semver from "semver";

export const compareSemver = (value: string | null | undefined, operator: Operator, targetValues: string[]) => {
  const lowercaseOperator = operator.toLowerCase();
  if (value == null || value.trim().length == 0) {
    return lowercaseOperator == "is not one of";
  }

  const semverValue = semver.coerce(value) ?? value;
  const semverTargets = targetValues.map((v) => semver.coerce(v) ?? v);
  try {
    switch (lowercaseOperator) {
      case "=":
        return safeEquals(semverValue, semverTargets[0]);
      case "<":
        return semver.lt(semverValue, semverTargets[0]);
      case "<=":
        return semver.lte(semverValue, semverTargets[0]);
      case ">":
        return semver.gt(semverValue, semverTargets[0]);
      case ">=":
        return semver.gte(semverValue, semverTargets[0]);
      case "is one of":
        return semverTargets.findIndex((v) => safeEquals(semverValue, v)) >= 0;
      case "is not one of":
        return semverTargets.findIndex((v) => safeEquals(semverValue, v)) < 0;
      default:
        return false;
    }
  } catch {
    return false;
  }
};

const safeEquals = (v1: string | semver.SemVer, v2: string | semver.SemVer): boolean => {
  try {
    return semver.eq(v1, v2);
  } catch {
    return false;
  }
};
