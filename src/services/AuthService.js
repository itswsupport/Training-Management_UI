/**
 * Authentication against the ETMS backend's `/login`.
 *
 * The backend answers HTTP 200 for every outcome, so the real result is
 * `status_code` in the body: 401 means "no active employee with that code".
 */

import { api, ApiStatus, apiErrorMessage } from "@/config/api";
import { getUserRole } from "@/lib/permissions";

/**
 * Signs in and returns the LoginUser the backend serialises.
 *
 * The backend compares the password with BCrypt against the EMS employee master
 * (db_ems), the copy the portal keeps current — so a wrong password now comes
 * back as UNAUTHORIZED. It used to accept any password at all for an existing
 * employee code.
 *
 * @param {string} empCode
 * @param {string} password
 * @returns {Promise<object>} the sanitised user
 */
export async function login(empCode, password) {
  const code = String(empCode ?? "").trim();

  if (!code || !password) {
    throw new Error("Employee code and password are required.");
  }
  return signIn(code, password);
}

/**
 * Signs in with the hand-off token the portal mints.
 *
 * The token goes to the backend untouched: it holds the AES key, decrypts the
 * employee code out of the token and checks its ten-minute window
 * (PortalTokenService). Nothing about the key is known here, which is the point
 * — a key in the browser bundle is a key anyone can mint tokens with.
 *
 * @param {string} token base64url token from the /etms/<token> URL
 * @returns {Promise<object>} the sanitised user
 */
export async function loginWithPortalToken(token) {
  if (!token) {
    throw new Error("No portal token supplied.");
  }

  let body;
  try {
    const res = await api.get("/login/token", { params: { token } });
    body = res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Training service is unavailable."));
  }

  if (body?.status_code === ApiStatus.INVALID_TOKEN) {
    throw new Error(
      "This sign-in link is no longer valid. Please open Training Management again from the portal."
    );
  }
  if (body?.status_code === ApiStatus.UNAUTHORIZED || !body?.response) {
    throw new Error("No active employee matches this sign-in link.");
  }
  if (body.status_code !== ApiStatus.SUCCESS) {
    throw new Error(body.message || "Unable to sign in.");
  }

  return toSessionUser(body.response, String(body.response.username ?? "").trim());
}

/** The shared /login call. `code` is validated here for both callers. */
async function signIn(code, password) {
  // The backend binds emp_code to a Java `long`; a non-numeric value fails type
  // conversion and never reaches the controller.
  if (!/^\d{1,18}$/.test(code)) {
    throw new Error("Employee code must be a number.");
  }

  let body;
  try {
    const res = await api.get("/login", {
      params: { emp_code: code, emp_pass: password },
    });
    body = res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Training service is unavailable."));
  }

  if (body?.status_code === ApiStatus.UNAUTHORIZED || !body?.response) {
    throw new Error("Invalid employee code or password.");
  }
  if (body.status_code !== ApiStatus.SUCCESS) {
    throw new Error(body.message || "Unable to sign in.");
  }

  return toSessionUser(body.response, code);
}

/**
 * Turns a LoginUser payload into the record the session holds.
 *
 * @param {object} response the backend's `response` object
 * @param {string} code the employee code this sign-in was for
 */
function toSessionUser(response, code) {
  // Older backends echoed the stored password hash back (the field had no
  // @JsonIgnore). It is dropped here as well as there, so an un-upgraded
  // backend cannot put a hash into localStorage.
  const { password: _hash, ...user } = response;

  // UserServiceImpl grants no authority at all to a user who has roles but is
  // neither a TRAINING OFFICER nor a level-1 reporting authority. The legacy
  // JSP crashed on `authorities[0]`; refuse cleanly instead.
  if (!getUserRole(user)) {
    throw new Error(
      "Your account has no training role assigned. Contact the training officer."
    );
  }

  return {
    ...user,
    // Keep the code that was typed, so it survives a backend that echoes a
    // differently-formatted username.
    user_id: code,
    empCode: user.username ?? code,
  };
}

/** Requests a password reset mail for an employee code. */
export async function forgetPassword(empCode) {
  try {
    const res = await api.get("/forgetPassword", {
      params: { emp_code: String(empCode ?? "").trim() },
    });
    return res.data;
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Could not process the request."));
  }
}
