import { toBase62 } from "./base62-encoder";

const DIGEST_BYTES = 16;
const BASE62_LENGTH = Math.ceil((DIGEST_BYTES * 8) / Math.log2(62));

const sha256 = async (value: string): Promise<Uint8Array> => {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(hashBuffer).subarray(0, DIGEST_BYTES);
};

export const generateValueId = async (v: string | number | boolean | null | undefined) => {
  const value = v?.toString() ?? "";
  return toBase62(await sha256(value), BASE62_LENGTH);
};
