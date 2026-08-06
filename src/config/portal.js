/**
 * The REPL portal this app is launched from.
 *
 * ETMS is opened from the portal's dashboard, which hands a signed employee
 * code over as `/etms/<token>` (see src/app/[token]/page.js). Leaving the app —
 * logging out — therefore means going back there, not to a login form the user
 * never came through.
 */

export const PORTAL_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_PORTAL_DASHBOARD_URL ||
  "https://replportal.co.in:8443/portal/dashboard.jsp";
