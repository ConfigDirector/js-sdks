import type { Operator } from "./types";
import { DateTime } from "luxon";

/**
 * Date and time comparisons.
 *
 * Parsing is delegated to Luxon rather than to `new Date`, for two reasons. `new Date` reads a
 * date-time with no offset as *local* time, which would make an evaluation depend on the
 * timezone of whichever machine ran it; `{ zone: "utc" }` gives the required reading directly.
 * And `new Date` rolls impossible dates over — `2026-02-30` becomes March 2nd — where the
 * ConfigDirector server and the Python SDK both reject them.
 *
 * Returns false whenever either side is missing or unparseable.
 */
export const compareDate = (value: string, operator: Operator, targetValues: string[]) => {
  const first: string | undefined = targetValues[0];
  if (first === undefined) {
    return false;
  }

  const dateValue = parseDate(value);
  const dateTarget = parseDate(first);
  if (dateValue === undefined || dateTarget === undefined) {
    return false;
  }

  switch (operator) {
    case "is after":
      return dateValue > dateTarget;
    case "is before":
      return dateValue < dateTarget;
    default:
      return false;
  }
};

/** The instant as milliseconds since the epoch, or undefined when the value is not a date. */
const parseDate = (value: string): number | undefined => {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toMillis() : undefined;
};
