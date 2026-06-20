const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const toBase62 = (buf: Uint8Array, length: number): string => {
  const ZERO = BigInt(0);
  const BASE = BigInt(62);
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  let n = BigInt("0x" + hex);
  let result = "";
  while (n > ZERO) {
    result = BASE62[Number(n % BASE)] + result;
    n /= BASE;
  }
  return result.padStart(length, "0");
};
