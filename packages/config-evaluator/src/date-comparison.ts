import type { Operator } from "./types";

export const compareDate = (value: string | null | undefined, operator: Operator, targetValues: string[]) => {
  if (value == null) {
    return false;
  }

  try {
    const dateValue = new Date(value);
    const dateTarget = new Date(targetValues[0]);
    switch (operator) {
      case "is after":
        return dateValue > dateTarget;
      case "is before":
        return dateValue < dateTarget;
      default:
        return false;
    }
  } catch {
    return false;
  }
};
