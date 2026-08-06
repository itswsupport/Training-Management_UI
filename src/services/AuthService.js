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
 * SECURITY NOTE: the backend discards its own password comparison
 * (LoginController.java) — any password is accepted for an existing employee
 * code — and it serialises the stored password hash back in the payload,
 * because the field carries no @JsonIgnore. The hash is stripped here so it is
 * never held in state or written to localStorage.
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
 * Signs in an employee code that a portal token already vouched for.
 *
 * The portal has authenticated the user; the token proves it. There is no
 * password to forward, and `emp_pass` is a required @RequestParam, so a
 * placeholder is sent — which changes nothing, because the backend compares no
 * passwords at all (see the note above). If it ever starts to, this needs a
 * real token endpoint on the backend rather than a different placeholder.
 *
 * @param {string} empCode decrypted out of the portal token
 * @returns {Promise<object>} the sanitised user
 */
export async function loginWithEmpCode(empCode) {
  const code = String(empCode ?? "").trim();

  if (!code) {
    throw new Error("The portal token carried no employee code.");
  }
  return signIn(code, "portal-token");
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

  // Drop the password hash the backend echoes back.
  const { password: _hash, ...user } = body.response;

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
