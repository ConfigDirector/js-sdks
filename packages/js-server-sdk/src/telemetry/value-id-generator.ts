import { createHash } from "node:crypto";
import { toBase62 } from "@shared/base62-encoder";
import { DIGEST_BYTES, BASE62_LENGTH } from "@shared/value-id";

export const generateValueId = async (v: string | number | boolean | null | undefined): Promise<string> => {
  const hash = createHash("sha256")
    .update(v?.toString() ?? "")
    .digest();
  return toBase62(hash.subarray(0, DIGEST_BYTES), BASE62_LENGTH);
};
