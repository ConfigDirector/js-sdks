import { rapidhash } from "rapidhash-js";
import { USER_CONTEXT_KIND } from "./context-kind";

const SEED = 0x397832987n;

export const PERCENTAGE_WITHOUT_IDENTIFIER = 0.0;

export const assignPercentage = ({
  configId,
  contextIdentifier,
  contextKind,
}: {
  configId: string;
  contextIdentifier: string;
  contextKind: string;
}): number => {
  const hashInput =
    contextKind === USER_CONTEXT_KIND
      ? `${contextIdentifier}-${configId}`
      : `${contextIdentifier}-${configId}:${contextKind}`;

  return Number(rapidhash(hashInput, { seed: SEED }) % 1_000n) / 10.0;
};
