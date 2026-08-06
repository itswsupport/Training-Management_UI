import crypto from "node:crypto";

/**
 * Resolves a portal hand-off token to an employee code.
 *
 * The REPL portal launches this app with `https://replportal.co.in/etms/<token>`,
 * where the token is produced by the portal's `encryptEmpCode()`:
 *
 *   base64url( AES-128-CBC( "empCode|timestampMillis" ) ), IV = the key bytes
 *
 * Decryption happens here, on the server, rather than in the browser:
 *   1. The AES key never reaches the client bundle, where anyone could read it
 *      in devtools and mint a token for any employee code.
 *   2. `crypto.subtle` only exists in a secure context, and this app is served
 *      over plain HTTP behind the portal — there it is simply undefined.
 *
 * Must stay in sync with the portal's `encryptEmpCode()` (dashboard.jsp).
 */

export const dynamic = "force-dynamic";

/** A token is only good for the length of the redirect it was minted for. */
const TOKEN_EXPIRY_MS = 10 * 60 * 1000;

/**
 * The portal ships this key inside its own page, so it is not a secret today;
 * it is the fallback purely so a deployment that has not set the env var keeps
 * working. Set ETMS_TOKEN_SECRET_KEY (and change it on the portal to match) for
 * this to be worth anything.
 */
const FALLBACK_SECRET = "REPL_EOB_2024_SK";

function getKey() {
  const secret = process.env.ETMS_TOKEN_SECRET_KEY || FALLBACK_SECRET;
  if (Buffer.byteLength(secret, "utf8") !== 16) {
    throw new Error("ETMS_TOKEN_SECRET_KEY must be exactly 16 bytes for AES-128.");
  }
  return Buffer.from(secret, "utf8");
}

function fail(error, status = 400) {
  return Response.json({ error }, { status });
}

export async function POST(request) {
  let token;
  try {
    ({ token } = await request.json());
  } catch {
    return fail("Malformed request body.");
  }

  if (!token || typeof token !== "string") {
    return fail("No token supplied.");
  }

  let plainText;
  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, key);
    plainText = Buffer.concat([
      decipher.update(Buffer.from(token, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    console.error("[decrypt-token] decryption failed:", err);
    return fail(
      "Token could not be decrypted. It was not issued by the portal, or the portal and this app are using different secret keys."
    );
  }

  const parts = plainText.split("|");
  if (parts.length !== 2) {
    return fail(
      "Token decrypted but its contents are not in the expected 'empCode|timestamp' format."
    );
  }

  const [rawEmpCode, rawTimestamp] = parts;
  const empCode = rawEmpCode.trim();

  // The backend binds emp_code to a Java `long`; anything else never reaches
  // the controller, so reject it here with a message that says why.
  if (!/^\d{1,18}$/.test(empCode)) {
    return fail("Token decrypted but carries no usable employee code.");
  }

  const timestamp = Number.parseInt(rawTimestamp, 10);
  if (Number.isNaN(timestamp)) {
    return fail("Token decrypted but carries an unreadable timestamp.");
  }

  // Measured against the server clock rather than the browser's, so a user's
  // misconfigured PC cannot expire a perfectly valid token.
  const age = Date.now() - timestamp;
  const minutes = (ms) => Math.round(Math.abs(ms) / 60000);

  if (age > TOKEN_EXPIRY_MS) {
    return fail(
      `Token expired — it was issued ${minutes(age)} minutes ago and is valid for 10 minutes. Please open Training Management again from the portal.`
    );
  }
  if (age < -TOKEN_EXPIRY_MS) {
    return fail(
      `Token is dated ${minutes(age)} minutes in the future. The portal server clock and this server's clock are out of sync.`
    );
  }

  return Response.json({ empCode });
}
