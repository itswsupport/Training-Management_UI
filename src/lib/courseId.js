/**
 * Obfuscates the numeric ids that appear in course URLs.
 *
 * `/course/284` becomes `/course/qbctd`, so a learner cannot read a module id
 * off the address bar or walk to the next course by typing `285`.
 *
 * This is NOT encryption. The transform below ships in the client bundle, so
 * anyone willing to read it can reverse it. It stops casual guessing and
 * enumeration — nothing else. Access control still has to live on the backend
 * `/emodule` endpoints, which continue to receive the plain numeric id (it is
 * visible in devtools Network either way).
 *
 * How it works: multiply by an odd constant mod 2^24 (invertible, and scatters
 * consecutive ids to unrelated outputs), XOR a constant, then write the result
 * in a shuffled base-28 alphabet. Decoding runs the same steps backwards.
 */

/**
 * Letters only, and shuffled so the ordering carries no information.
 *
 * Digits are deliberately absent. With them in the alphabet an old bookmark
 * like /course/778 decodes cleanly to an unrelated but perfectly valid course
 * (2533, as it happens) and the learner is shown the wrong page with no error.
 * Excluding digits makes every pre-existing numeric URL fail to decode, which
 * surfaces as "course not found" — the honest outcome.
 *
 * i, l and o are dropped too, so a token copied by hand cannot be mistyped into
 * a different valid course.
 */
const ALPHABET = "kzqwbxfmjdhsyrpvgtcnaue";
const BASE = ALPHABET.length; // 23

const MASK = 0xffffff; // 24 bits — ids run to 16.7M, far past anything ETMS has
const MUL = 0x5f3a7b; // odd, therefore invertible mod 2^24
const INV = 0x6194b3; // MUL * INV === 1 (mod 2^24)
const XOR = 0x3d91c7;

/** 23^6 > 2^24 > 23^5, so every id fits in at most six characters. */
const MAX_TOKEN_LENGTH = 6;

/**
 * Turns a numeric id into its URL token.
 *
 * @param {number|string} id the real database id
 * @returns {string} the token to put in the URL, e.g. "qbctd"
 */
export function encodeId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0 || n > MASK) return "";

  // n * MUL peaks near 2^47, well inside the exact-integer range, and `&`
  // truncates it to 24 bits.
  let x = (((n * MUL) & MASK) ^ XOR) & MASK;

  let out = "";
  do {
    out = ALPHABET[x % BASE] + out;
    x = Math.floor(x / BASE);
  } while (x > 0);
  return out;
}

/**
 * Reverses {@link encodeId}.
 *
 * Returns NaN for anything that is not a token this app minted — a truncated
 * link, a hand-typed guess, a stray character. Callers must treat that as
 * "course not found" rather than passing it to the API.
 *
 * @param {string} token the `[id]` route segment
 * @returns {number} the real id, or NaN
 */
export function decodeId(token) {
  if (typeof token !== "string") return NaN;
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return NaN;

  let x = 0;
  for (const ch of token) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return NaN;
    x = x * BASE + i;
  }
  // 23^6 overshoots 2^24, so a six-character token can still be out of range.
  if (x > MASK) return NaN;

  return ((x ^ XOR) * INV) & MASK;
}
