/**
 * Rendering a resolved context value to text.
 */

/** A value the context does not carry. Compared as "", so a negative operator can still match. */
export const ABSENT = Symbol("absent");

/** An attribute this SDK version does not know about. Not compared at all. */
export const UNKNOWN_ATTRIBUTE = Symbol("unknown-attribute");

export type Resolved = unknown | typeof ABSENT;

export const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/**
 * Render a resolved value to text. Absent values, and values with no meaningful text form —
 * arrays, objects, null — render to the empty string rather than to something like
 * "[object Object]".
 */
export const render = (value: Resolved): string => {
  if (value === ABSENT || value === null || value === undefined) {
    return "";
  }
  return isScalar(value) ? renderScalar(value) : "";
};

/** Render a scalar the way JSON would spell it: `true`, `26`, `26.5`. */
export const renderScalar = (value: string | number | boolean): string => {
  if (typeof value === "string") {
    return value;
  }
  return String(value);
};

/** The raw value, for comparisons that inspect its JSON type rather than its text. */
export const unwrap = (value: Resolved): unknown => (value === ABSENT ? undefined : value);
