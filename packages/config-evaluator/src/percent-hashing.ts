import { rapidhash } from "rapidhash-js";

const SEED = 0x397832987n;

export const PERCENTAGE_WITHOUT_IDENTIFIER = 0.0;

export const assignPercentage = (data: {configId: string, contextIdentifier: string}): number => {
  const value = `${data.contextIdentifier}-${data.configId}`;

  return Number(rapidhash(value, { seed: SEED }) % 1_000n) / 10.0;
};
