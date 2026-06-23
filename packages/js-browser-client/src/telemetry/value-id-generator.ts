import { toBase62 } from "@shared/base62-encoder";
import { DIGEST_BYTES, BASE62_LENGTH } from "@shared/value-id";

const encoder = new TextEncoder();

export const generateValueId = async (v: string | number | boolean | null | undefined): Promise<string> => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(v?.toString() ?? ""));
  return toBase62(new Uint8Array(hashBuffer, 0, DIGEST_BYTES), BASE62_LENGTH);
};
