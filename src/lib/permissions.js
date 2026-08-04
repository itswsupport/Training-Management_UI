/**
 * Role-based access control for ETMS.
 *
 * The backend (UserServiceImpl.loadUserByUsername) grants exactly one of three
 * authorities. Anyone with roles who is neither a training officer nor a
 * level-1 reporting authority gets no authority at all — that user cannot use
 * the app and is rejected at login rather than crashing a dashboard.
 */

export const AUTHORITY_TRAINING_OFFICER = "TRAINING OFFICER";
export const AUTHORITY_HOD = "HOD";
export const AUTHORITY_USER = "USER";

export const ROLES = {
  TRAINING_OFFICER: AUTHORITY_TRAINING_OFFICER,
  HOD: AUTHORITY_HOD,
  USER: AUTHORITY_USER,
};

/** Normalises the spelling variants the backend and older records use. */
function normalizeRole(role) {
  if (!role || typeof role !== "string") return null;
  const upper = role.trim().toUpperCase();
  if (["TRAINING_OFFICER", "TRAININGOFFICER", "TRAINING-OFFICER"].includes(upper)) {
    return AUTHORITY_TRAINING_OFFICER;
  }
  return upper;
}

/**
 * Every authority on the user, de-duplicated and normalised.
 *
 * Jackson serialises LoginUser with the same collection under BOTH
 * `authorities` (the UserDetails getter) and `authority` (the plain getter),
 * so both are read.
 *
 * @param {object|null} user
 * @returns {string[]}
 */
export function getAllUserRoles(user) {
  if (!user) return [];
  const roles = new Set();

  const collect = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const role = normalizeRole(
          typeof entry === "string" ? entry : entry?.authority
        );
        if (role) roles.add(role);
      });
      return;
    }
    const role = normalizeRole(
      typeof value === "string" ? value : value?.authority
    );
    if (role) roles.add(role);
  };

  collect(user.authorities);
  collect(user.authority);
  collect(user.role);

  return Array.from(roles);
}

/**
 * The user's primary role, in precedence order. A training officer who is also
 * a HOD lands on the officer dashboard.
 *
 * @param {object|null} user
 * @returns {string|null}
 */
export function getUserRole(user) {
  const roles = getAllUserRoles(user);
  if (roles.includes(AUTHORITY_TRAINING_OFFICER)) return AUTHORITY_TRAINING_OFFICER;
  if (roles.includes(AUTHORITY_HOD)) return AUTHORITY_HOD;
  if (roles.includes(AUTHORITY_USER)) return AUTHORITY_USER;
  return null;
}

export function isTrainingOfficer(user) {
  return getAllUserRoles(user).includes(AUTHORITY_TRAINING_OFFICER);
}

/** Pages reachable without a session. */
export const PUBLIC_ROUTES = ["/Login", "/reset-password"];

/**
 * Pages that render on their own, with no sidebar and no header bar.
 *
 * The user manual opens in its own tab and is a document rather than a screen
 * of the app — the shell's navigation around it would only be a second way out
 * of something the reader did not navigate into. Still behind the session:
 * chromeless is about the frame, not about who may read it.
 */
export const CHROMELESS_ROUTES = ["/user-guide"];

export function isChromelessRoute(pathname) {
  return CHROMELESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Route prefix → the roles allowed to open it. A prefix that is absent from
 * this map is open to every signed-in user (course pages, certificates).
 */
const ROUTE_ROLES = {
  "/TrainingOfficerDashboard": [AUTHORITY_TRAINING_OFFICER],
};

export function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

/**
 * Whether `user` may open `pathname`.
 *
 * @param {object|null} user
 * @param {string} pathname
 * @returns {boolean}
 */
export function canAccessRoute(user, pathname) {
  if (isPublicRoute(pathname)) return true;
  if (!user) return false;

  const match = Object.keys(ROUTE_ROLES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!match) return true;

  const roles = getAllUserRoles(user);
  return ROUTE_ROLES[match].some((role) => roles.includes(role));
}

/** Where a user lands after signing in, or after being bounced off a page. */
export function getDefaultDashboardForUser(user) {
  return isTrainingOfficer(user) ? "/TrainingOfficerDashboard" : "/UserDashboard";
}

/**
 * The employee code used for every backend read. `username` is what the
 * backend echoes back; `user_id` is what was typed at login.
 */
export function getEmpCode(user) {
  return String(user?.username ?? user?.empCode ?? user?.user_id ?? "").trim();
}

/** "FIRST LAST", falling back to the employee code. */
export function getDisplayName(user) {
  const name = [user?.userFname, user?.userLname].filter(Boolean).join(" ").trim();
  return name || getEmpCode(user) || "USER";
}
