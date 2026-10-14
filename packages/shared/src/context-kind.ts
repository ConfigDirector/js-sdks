import type { ConfigDirectorContext } from "./types";

const CONTEXT_KIND_MAXIMUM_LENGTH = 64;
const KIND_SAMPLE_MAXIMUM_CHARACTERS = 128;

type ContextAdmission =
  | { outcome: "admitted"; context: ConfigDirectorContext | undefined }
  | { outcome: "ignored"; kindSample: string };

const isContextKindCharacter = (character: string): boolean =>
  (character >= "a" && character <= "z") ||
  (character >= "0" && character <= "9") ||
  character === "-" ||
  character === "_";

const isValidContextKind = (kind: string): boolean => {
  if (kind.length < 1 || kind.length > CONTEXT_KIND_MAXIMUM_LENGTH) {
    return false;
  }
  for (const character of kind) {
    if (!isContextKindCharacter(character)) {
      return false;
    }
  }
  return true;
};

const isAcceptedKind = (kind: unknown): boolean =>
  kind === undefined || kind === null || (typeof kind === "string" && isValidContextKind(kind));

const stringFormOf = (kind: unknown): string => {
  if (typeof kind === "string") {
    return kind;
  }
  try {
    return String(kind);
  } catch {
    return Object.prototype.toString.call(kind);
  }
};

const firstCharactersOf = (text: string, maximumCharacters: number): string => {
  let sample = "";
  let characterCount = 0;
  for (const character of text) {
    if (characterCount === maximumCharacters) {
      break;
    }
    sample += character;
    characterCount += 1;
  }
  return sample;
};

export const admitContext = (context: ConfigDirectorContext | undefined): ContextAdmission => {
  const kind: unknown = context?.kind;
  if (isAcceptedKind(kind)) {
    return { outcome: "admitted", context };
  }
  return {
    outcome: "ignored",
    kindSample: firstCharactersOf(stringFormOf(kind), KIND_SAMPLE_MAXIMUM_CHARACTERS),
  };
};
