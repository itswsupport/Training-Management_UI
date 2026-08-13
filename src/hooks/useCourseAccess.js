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
import {
  isQuarterUpcoming,
  quarterStartLabel,
} from "@/services/MasterDataService";
import { COURSE_STATUS, getAssignedCourse } from "@/services/UserCourseService";

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
 * @returns {{checking: boolean, allowed: boolean, overdue: boolean,
 *   locked: boolean, unlocksOn: string, attemptsLeft: number}} `checking` stays
 *   true through the refusal, so a blocked page renders nothing behind the
 *   alert; `overdue` marks a course that may be read but not submitted to;
 *   `locked` marks one whose quarter has not started, which may not be opened
 *   at all yet, and `unlocksOn` is the day it does; `attemptsLeft` is the
 *   sittings remaining on a course handed back after a grade C.
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
  const [lookup, setLookup] = useState({
    courseId: null,
    status: null,
    kraQuarter: "",
    attemptsLeft: 0,
    retakes: 0,
  });

  useEffect(() => {
    if (!needsLookup) return undefined;
    let cancelled = false;

    getAssignedCourse(empCode, emoduleId)
      .then((found) => {
        if (cancelled) return;
        setLookup({
          courseId: emoduleId,
          status: found?.status ?? null,
          kraQuarter: found?.course?.kraQuarter ?? "",
          attemptsLeft: found?.course?.attemptsLeft ?? 0,
          retakes: found?.course?.retakes ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLookup({
            courseId: emoduleId,
            status: null,
            kraQuarter: "",
            attemptsLeft: 0,
            retakes: 0,
          });
        }
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

  /**
   * The course is raised for a quarter that has not started yet.
   *
   * It is assigned, and it sits in PENDING from the day it is created, so the
   * learner can see what is coming. There is nothing to do in it until its
   * quarter opens, though, so until then it may not be entered at all — unlike
   * an overdue course, which stays readable.
   *
   * Officers are exempt for the same reason they are exempt from `overdue`:
   * their pages are read-only previews and they submit nothing here, so a
   * course they raised for next quarter must still be theirs to check.
   */
  const locked =
    !officer &&
    lookup.courseId === emoduleId &&
    lookup.status !== null &&
    isQuarterUpcoming(lookup.kraQuarter);

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
  return {
    checking: checking || refused,
    allowed,
    overdue,
    locked,
    // "01-04-2026" — the day it opens, for the notice that says so.
    unlocksOn: locked ? quarterStartLabel(lookup.kraQuarter) : "",
    /**
     * Sittings left on a course handed back after a grade C — 0 once they have
     * all been used, and 0 as well on a course that never came back. `retakes`
     * below is what tells those two apart. An officer previewing has no attempt
     * of their own, so it is always 0 for them.
     */
    attemptsLeft:
      !officer && lookup.courseId === emoduleId ? lookup.attemptsLeft : 0,
    /**
     * How many times this course has been handed back — 0 on a first sitting.
     *
     * Which sitting the learner is on, in other words, and so which set of
     * per-browser progress belongs to them: the watched ticks and the
     * answered-question sets are keyed on it, so a returned course starts
     * from nothing rather than inheriting the last attempt's ticks.
     */
    retakes: lookup.courseId === emoduleId ? lookup.retakes : 0,
  };
}
