"use client";

/**
 * Client side of the portal → ETMS hand-off.
 *
 * The portal's dashboard encrypts the signed-in employee code and sends the
 * browser to `https://replportal.co.in/etms/<token>`. The AES work lives in
 * src/app/auth/decrypt-token/route.js — nothing here knows the key, and nothing
 * here touches `crypto.subtle`, which is undefined on the plain-HTTP origin
 * production is served from.
 */

// window.location and fetch both ignore Next's basePath, so a bare
// "/auth/..." would miss the app entirely once it is mounted under /etms.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/etms";

const DECRYPT_URL = `${BASE_PATH}/auth/decrypt-token`;

/**
 * Resolves a portal token to an employee code.
 *
 * Throws with the specific reason the token was refused — expired, wrong key,
 * not a portal token at all — so the page can show it rather than a generic
 * "login failed".
 *
 * @param {string} token base64url token from the URL
 * @returns {Promise<string>} the employee code
 */
export async function decryptPortalToken(token) {
  let res;
  try {
    res = await fetch(DECRYPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    throw new Error("Could not reach the token service.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Token service did not return JSON (HTTP ${res.status}).`);
  }

  if (!res.ok || !data?.empCode) {
    throw new Error(
      data?.error || `Token could not be validated (HTTP ${res.status}).`
    );
  }

  return data.empCode;
}
