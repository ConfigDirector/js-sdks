import type { Sha256HexDigest } from "@js-client-core/types";

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const sha256HexDigestIfAvailable = (): Sha256HexDigest | undefined => {
  if (typeof crypto === "undefined" || crypto.subtle == null) {
    return undefined;
  }
  return async (text) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return toHex(new Uint8Array(digest));
  };
};
