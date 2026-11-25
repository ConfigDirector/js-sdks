import { admitContext } from "@shared/context-kind";
import type { ContextSizeLimitReason } from "@shared/telemetry/telemetry-events";
import { utf8ByteLength } from "@shared/utf8-byte-length";
import type { ConfigDirectorContext } from "./types";

const IDENTIFIER_MAXIMUM_CHARACTERS = 256;
const NAME_MAXIMUM_CHARACTERS = 256;
const TRAITS_MAXIMUM_JSON_BYTES = 65_536;

type ClientContextAdmission =
  | { outcome: "admitted"; context: ConfigDirectorContext | undefined }
  | { outcome: "invalid kind"; kindSample: string }
  | { outcome: "over a size limit"; reason: ContextSizeLimitReason };

const hasMoreCharactersThan = (maximumCharacters: number, text: string | undefined): boolean =>
  typeof text === "string" && Array.from(text).length > maximumCharacters;

const hasMoreJsonBytesThan = (maximumBytes: number, traits: ConfigDirectorContext["traits"]): boolean => {
  let json: string | undefined;
  try {
    json = JSON.stringify(traits);
  } catch {
    return false;
  }
  return json !== undefined && utf8ByteLength(json) > maximumBytes;
};

const firstSizeLimitPassedBy = (
  context: ConfigDirectorContext | undefined,
): ContextSizeLimitReason | undefined => {
  if (hasMoreCharactersThan(IDENTIFIER_MAXIMUM_CHARACTERS, context?.id)) {
    return "identifier-too-long";
  }
  if (hasMoreCharactersThan(NAME_MAXIMUM_CHARACTERS, context?.name)) {
    return "name-too-long";
  }
  if (hasMoreJsonBytesThan(TRAITS_MAXIMUM_JSON_BYTES, context?.traits)) {
    return "traits-too-large";
  }
  return undefined;
};

export const admitClientContext = (context: ConfigDirectorContext | undefined): ClientContextAdmission => {
  const kindAdmission = admitContext(context);
  if (kindAdmission.outcome === "ignored") {
    return { outcome: "invalid kind", kindSample: kindAdmission.kindSample };
  }
  const passedSizeLimit = firstSizeLimitPassedBy(context);
  if (passedSizeLimit !== undefined) {
    return { outcome: "over a size limit", reason: passedSizeLimit };
  }
  return { outcome: "admitted", context };
};
