/**
 * Mints a portal hand-off token, for testing the /etms/<token> login locally.
 *
 * This is the exact thing the portal's `encryptEmpCode()` produces — CryptoJS
 * AES-128-CBC with key = IV = the shared secret, base64 made URL-safe:
 *
 *   base64url( AES-128-CBC( "empCode|timestampMillis" ) )
 *
 * Usage:
 *   node scripts/mint-portal-token.mjs 10234
 *   node scripts/mint-portal-token.mjs 10234 --age 11   # 11 minutes old, to
 *                                                       # see the expiry path
 *
 * The key must match the server's: set ETMS_TOKEN_SECRET_KEY in both places, or
 * leave it unset in both and the shared fallback is used.
 */

import crypto from "node:crypto";

const FALLBACK_SECRET = "REPL_EOB_2024_SK";
const BASE_URL = process.env.ETMS_BASE_URL || "http://localhost:3000/etms";

const args = process.argv.slice(2);
const empCode = args.find((a) => !a.startsWith("--")) ?? "10234";
const ageIndex = args.indexOf("--age");
const ageMinutes = ageIndex === -1 ? 0 : Number(args[ageIndex + 1] ?? 0);

const secret = process.env.ETMS_TOKEN_SECRET_KEY || FALLBACK_SECRET;
if (Buffer.byteLength(secret, "utf8") !== 16) {
  console.error("ETMS_TOKEN_SECRET_KEY must be exactly 16 bytes for AES-128.");
  process.exit(1);
}

const key = Buffer.from(secret, "utf8");
const issuedAt = Date.now() - ageMinutes * 60 * 1000;

const cipher = crypto.createCipheriv("aes-128-cbc", key, key);
const token = Buffer.concat([
  cipher.update(`${empCode}|${issuedAt}`, "utf8"),
  cipher.final(),
])
  .toString("base64")
  // The portal strips base64 padding and swaps the two non-URL-safe characters.
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/g, "");

console.log(`emp code : ${empCode}`);
console.log(`issued   : ${new Date(issuedAt).toISOString()}${ageMinutes ? ` (${ageMinutes} min old)` : ""}`);
console.log(`token    : ${token}`);
console.log(`open     : ${BASE_URL}/${token}`);
