import type { ConfigDirectorContext, ConfigDirectorLogger, TrackOptions, TrackedEventDetails } from "../types";
import { utf8ByteLength } from "../utf8-byte-length";
import { reportedContextOf } from "./reported-context";

export const TRACKED_EVENTS_PER_BATCH = 1_000;
const NAME_MAXIMUM_CHARACTERS = 150;
const NAME_MAXIMUM_UTF16_UNITS = NAME_MAXIMUM_CHARACTERS * 2;
const DETAILS_MAXIMUM_TOP_LEVEL_KEYS = 20;
const DETAILS_MAXIMUM_JSON_BYTES = 1_024;

export type TrackedEventEntry = {
  name: string;
  contextKind?: string;
  contextIdentifier?: string;
  value?: number;
  details?: TrackedEventDetails;
  happenedAt: string;
};

type TrackCall = {
  name: string;
  context: ConfigDirectorContext | undefined;
  options: TrackOptions | undefined;
  happenedAt: Date;
};

export type TrackedEventWarning =
  | "name-outside-the-character-limit"
  | "value-not-a-finite-number"
  | "details-not-reportable"
  | "batch-already-full";

export const trackedEventWarningMessages: { [W in TrackedEventWarning]: string } = {
  "name-outside-the-character-limit": `[ConfigDirectorClient] A tracked event was not reported because its name does not have 1 to ${NAME_MAXIMUM_CHARACTERS} characters.`,
  "value-not-a-finite-number":
    "[ConfigDirectorClient] A tracked event was reported without its value because the value is not a finite number.",
  "details-not-reportable": `[ConfigDirectorClient] A tracked event was reported without its details because they are not an object, have more than ${DETAILS_MAXIMUM_TOP_LEVEL_KEYS} top-level keys, are larger than ${DETAILS_MAXIMUM_JSON_BYTES} bytes as JSON, or cannot be written as JSON.`,
  "batch-already-full": `[ConfigDirectorClient] A tracked event was not reported because ${TRACKED_EVENTS_PER_BATCH} tracked events are already waiting for the next telemetry batch.`,
};

export const logBatchWarnings = (logger: ConfigDirectorLogger, warnings: TrackedEventWarning[]): void => {
  for (const warning of warnings) {
    logger.warn(
      `${trackedEventWarningMessages[warning]} Further tracked events like it are not logged until the next telemetry batch is sent.`,
    );
  }
};

export type TrackedEventAdmission =
  | { outcome: "admitted"; entry: TrackedEventEntry; warnings: TrackedEventWarning[] }
  | { outcome: "dropped"; warnings: TrackedEventWarning[] };

type ReportableOption<Fields> =
  | { status: "not-given" }
  | { status: "reportable"; fields: Fields }
  | { status: "left-out"; warning: TrackedEventWarning };

const isGiven = (option: unknown): boolean => option !== undefined && option !== null;

const isNonArrayObject = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);

const isWithinTheCharacterLimit = (name: unknown): name is string =>
  typeof name === "string" &&
  name.length >= 1 &&
  name.length <= NAME_MAXIMUM_UTF16_UNITS &&
  Array.from(name).length <= NAME_MAXIMUM_CHARACTERS;

const reportableValueOf = (value: unknown): ReportableOption<{ value: number }> => {
  if (!isGiven(value)) {
    return { status: "not-given" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { status: "reportable", fields: { value } };
  }
  return { status: "left-out", warning: "value-not-a-finite-number" };
};

const jsonCopyWithinTheLimits = (details: unknown): TrackedEventDetails | undefined => {
  if (!isNonArrayObject(details)) {
    return undefined;
  }
  try {
    const json: unknown = JSON.stringify(details);
    if (typeof json !== "string" || utf8ByteLength(json) > DETAILS_MAXIMUM_JSON_BYTES) {
      return undefined;
    }

    const copy: unknown = JSON.parse(json);
    const isWithinTheKeyLimit =
      isNonArrayObject(copy) && Object.keys(copy).length <= DETAILS_MAXIMUM_TOP_LEVEL_KEYS;
    return isWithinTheKeyLimit ? (copy as TrackedEventDetails) : undefined;
  } catch {
    return undefined;
  }
};

const reportableDetailsOf = (details: unknown): ReportableOption<{ details: TrackedEventDetails }> => {
  if (!isGiven(details)) {
    return { status: "not-given" };
  }
  const jsonCopy = jsonCopyWithinTheLimits(details);
  if (jsonCopy === undefined) {
    return { status: "left-out", warning: "details-not-reportable" };
  }
  return { status: "reportable", fields: { details: jsonCopy } };
};

const fieldsOf = <Fields>(option: ReportableOption<Fields>): Fields | undefined =>
  option.status === "reportable" ? option.fields : undefined;

const warningsOf = (...options: ReportableOption<unknown>[]): TrackedEventWarning[] =>
  options.flatMap((option) => (option.status === "left-out" ? [option.warning] : []));

export const admitTrackedEvent = (call: TrackCall): TrackedEventAdmission => {
  if (!isWithinTheCharacterLimit(call.name)) {
    return { outcome: "dropped", warnings: ["name-outside-the-character-limit"] };
  }

  const value = reportableValueOf(call.options?.value);
  const details = reportableDetailsOf(call.options?.details);
  return {
    outcome: "admitted",
    entry: {
      name: call.name,
      ...reportedContextOf(call.context),
      ...fieldsOf(value),
      ...fieldsOf(details),
      happenedAt: call.happenedAt.toISOString(),
    },
    warnings: warningsOf(value, details),
  };
};
