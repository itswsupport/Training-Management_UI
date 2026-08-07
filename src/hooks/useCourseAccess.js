"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { alerts } from "@/lib/alerts";
import { hasCourseGrant } from "@/lib/courseGrant";
import {
  getDefaultDashboardForUser,
  getEmpCode,
  isTrainingOfficer,
} from "@/lib/permissions";
import { COURSE_STATUS, getAssignedStatus } from "@/services/UserCourseService";

/**
 * Decides whether the signed-in user may open the course named in the URL, and
 * turns them away with an ACCESS DENIED alert if not.
 *
 * Two things have to hold:
 *
 *   1. The app navigated them here. Following a link records a grant (see
 *      lib/courseGrant); typing or editing an address does not. This is the
 *      part that stops URL tampering, and it applies to everyone — a training
 *      officer's module list links all 99 modules, so no set of ids is "wrong"
 *      for them to hold and only the route they took distinguishes a real
 *      visit.
 *   2. For a learner, the course is one of their own. A grant is a browser-side
 *      record and could be forged in devtools; this keeps a forged one from
 *      reaching another employee's course. Officers are exempt, since every
 *      module is legitimately theirs to open.
 *
 * Fails closed: while the answer is unknown the caller must not render the
 * course, and an error answers "no".
 *
 * @param {number} emoduleId the decoded module id, or NaN for a bad URL token
 * @returns {{checking: boolean, allowed: boolean, overdue: boolean}} `checking`
 *   stays true through the refusal, so a blocked page renders nothing behind
 *   the alert; `overdue` marks a course that may be read but not submitted to
 */
export function useCourseAccess(emoduleId) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const empCode = getEmpCode(user);
  const officer = isTrainingOfficer(user);

  const known = Number.isFinite(emoduleId);
  // Read during render rather than into state: a grant lasts far longer than a
  // page view, so it cannot flip mid-view, and holding it in state would let a
  // verdict for the previous course survive a client-side route change.
  const granted = known && hasCourseGrant(emoduleId);

  const needsLookup =
    !authLoading && granted && !officer && Boolean(empCode);

  // Keyed by the course it answers for: a result left over from the previously
  // viewed course must never be read as a verdict on this one.
  const [lookup, setLookup] = useState({ courseId: null, status: null });

  useEffect(() => {
    if (!needsLookup) return undefined;
    let cancelled = false;

    getAssignedStatus(empCode, emoduleId)
      .then((status) => {
        if (!cancelled) setLookup({ courseId: emoduleId, status });
      })
      .catch(() => {
        if (!cancelled) setLookup({ courseId: emoduleId, status: null });
      });

    return () => {
      cancelled = true;
    };
  }, [needsLookup, empCode, emoduleId]);

  let checking = false;
  let allowed = false;

  if (authLoading) {
    checking = true;
  } else if (!granted) {
    // No grant means the address bar, not a link — refused for everyone.
    allowed = false;
  } else if (officer) {
    allowed = true;
  } else if (!empCode) {
    allowed = false;
  } else if (lookup.courseId !== emoduleId) {
    checking = true;
  } else {
    allowed = lookup.status !== null;
  }

  // The quarter has lapsed: the course stays readable, but nothing may be
  // submitted against it. Never true for an officer, who submits nothing here
  // in any case — their pages are already read-only previews.
  const overdue =
    !officer &&
    lookup.courseId === emoduleId &&
    lookup.status === COURSE_STATUS.OVERDUE;

  const refused = !checking && !allowed;

  // One alert per refusal, not one per render.
  const announced = useRef(false);
  useEffect(() => {
    if (!refused) {
      announced.current = false;
      return;
    }
    if (announced.current) return;
    announced.current = true;

    (async () => {
      await alerts.error(
        "You cannot open this course by changing the address. Please open it from your dashboard.",
        "ACCESS DENIED"
      );
      // Only once they have read it — and `replace`, not `push`, or Back would
      // land them straight back on the URL they were just refused.
      router.replace(getDefaultDashboardForUser(user));
    })();
  }, [refused, router, user]);

  // Refused reports as still checking so the page renders its spinner, never
  // its content, behind the alert.
  return { checking: checking || refused, allowed, overdue };
}
