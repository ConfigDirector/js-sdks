import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { Sha256HexDigest } from "@js-client-core/types";
import { encodeUtf8 } from "./utf8Encoder";

export const sha256HexDigest: Sha256HexDigest = (text) => Promise.resolve(bytesToHex(sha256(encodeUtf8(text))));
