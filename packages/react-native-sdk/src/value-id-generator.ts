import { sha256 } from "@noble/hashes/sha2.js";
import { encodeUtf8 } from "./utf8Encoder";
import { toBase62 } from "@shared/base62-encoder";
import { DIGEST_BYTES, BASE62_LENGTH } from "@shared/value-id";

export const generateValueId = (v: string | number | boolean | null | undefined): string => {
  const value = v?.toString() ?? "";
  return toBase62(sha256(encodeUtf8(value)).subarray(0, DIGEST_BYTES), BASE62_LENGTH);
};
