import { sha256 } from "@noble/hashes/sha2.js";
import { encodeUtf8 } from "./utf8Encoder";
import { toBase62 } from "@shared/base62-encoder";

const DIGEST_BYTES = 16;
const BASE62_LENGTH = Math.ceil((DIGEST_BYTES * 8) / Math.log2(62));

export const generateValueId = (v: string | number | boolean | null | undefined): string => {
  const value = v?.toString() ?? "";
  return toBase62(sha256(encodeUtf8(value)).subarray(0, DIGEST_BYTES), BASE62_LENGTH);
};
