/**
 * Encodes a string to a UTF-8 byte sequence.
 *
 * Uses the native TextEncoder when available (Hermes runtime). For environments
 * that lack it (JSC), falls back to a manual implementation that follows the
 * UTF-8 encoding algorithm from the Unicode standard:
 *
 *   U+0000–U+007F    →  1 byte   0xxxxxxx
 *   U+0080–U+07FF    →  2 bytes  110xxxxx 10xxxxxx
 *   U+0800–U+FFFF    →  3 bytes  1110xxxx 10xxxxxx 10xxxxxx
 *   U+10000–U+10FFFF →  4 bytes  11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
 *
 * JavaScript strings are UTF-16, so code points above U+FFFF are stored as
 * surrogate pairs and must be recombined before encoding.
 */
export const encodeUtf8 = (str: string): Uint8Array => {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(str);
  }
  return encodeManually(str);
};

const encodeManually = (str: string): Uint8Array => {
  const bytes: number[] = [];
  let i = 0;

  while (i < str.length) {
    let cp = str.charCodeAt(i++);

    // Recombine a UTF-16 surrogate pair into a single code point.
    if (cp >= 0xd800 && cp <= 0xdbff && i < str.length) {
      const low = str.charCodeAt(i);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }

    if (cp <= 0x7f) {
      bytes.push(cp);
    } else if (cp <= 0x7ff) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp <= 0xffff) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }

  return new Uint8Array(bytes);
};
