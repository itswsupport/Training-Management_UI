"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { alerts } from "@/lib/alerts";
import {
  hasCourseGrant,
  hasOfficerQuery,
  isOfficerCourseView,
} from "@/lib/courseGrant";
import { reviewEmpFromUrl } from "@/lib/courseReview";
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
 *      reaching another employee's course. An officer managing a module is
 *      exempt, since every module is legitimately theirs to open.
 *
 * Holding the officer authority is not on its own what makes a page read-only.
 * Courses are allotted to training officers as well, and one they opened from
 * their own USER dashboard is theirs to sit: it has a due quarter, it can fall
 * overdue, and it can come back after a grade C, exactly as it would for anyone
 * else. What separates the two is whether the course is allotted to them and
 * which list they came in through — answered here as `preview`, which every
 * course page reads from rather than deciding for itself, so the course page
 * and the lecture and assignment pages under it cannot drift apart on it.
 *
 * Fails closed: while the answer is unknown the caller must not render the
 * course, and an error answers "no".
 *
 * @param {number} emoduleId the decoded module id, or NaN for a bad URL token
 * @returns {{checking: boolean, allowed: boolean, preview: boolean,
 *   canManage: boolean, overdue: boolean, locked: boolean, unlocksOn: string,
 *   attemptsLeft: number, retakes: number}} `checking` stays true through the
 *   refusal, so a blocked page renders nothing behind the alert; `preview` says
 *   the course is being looked at rather than sat and `canManage` that it may
 *   also be edited; `overdue` marks a
 *   course that may be read but not submitted to; `locked` marks one whose
 *   quarter has not started, which may not be opened at all yet, and
 *   `unlocksOn` is the day it does; `attemptsLeft` is the sittings remaining on
 *   a course handed back after a grade C.
 */
export function useCourseAccess(emoduleId) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const empCode = getEmpCode(user);

  const known = Number.isFinite(emoduleId);
  // Read during render rather than into state: a grant lasts far longer than a
  // page view, so it cannot flip mid-view, and holding it in state would let a
  // verdict for the previous course survive a client-side route change.
  const granted = known && hasCourseGrant(emoduleId);

  const officer = known && isTrainingOfficer(user);

  /**
   * Came in through the Training Officer Dashboard's ALL MODULES list, which
   * links with ?from=officer — the one entry point that carries editing.
   *
   * The query string is read as well as the stored mode because the course
   * page keeps ?from=officer in its address across a reload; the stored mode is
   * what carries the same answer down to /watch and /assignment, whose links
   * have no room to repeat it.
   */
  const canManage =
    officer && (isOfficerCourseView(emoduleId) || hasOfficerQuery());

  /**
   * Whose attempt the address names, or "" when it names nobody.
   *
   * COURSE STATUS lists one row per employee per course, so its links carry
   * `?emp=` — see lib/courseReview. Read after mount rather than during render:
   * the address is a browser-only thing, and reading it inline would have the
   * server's HTML and the client's first render disagree. Null until it has
   * been read, which is not the same as "nobody" and is what `checking` below
   * waits on.
   */
  const [urlEmp, setUrlEmp] = useState(null);
  useEffect(() => {
    setUrlEmp(reviewEmpFromUrl());
  }, [emoduleId]);

  /**
   * An officer reading somebody else's attempt.
   *
   * This is the one entry that says so, because COURSE STATUS is the only
   * screen whose rows are an ATTEMPT rather than a module, and its links carry
   * no ?from=officer — so `canManage` cannot stand in for it.
   *
   * Compared against the viewer's own code, not merely tested for presence: a
   * link that happens to name the viewer is their own course, and reading it as
   * a review would take away the page they are entitled to sit.
   *
   * A code in the URL is still not authority — it only ever selects which
   * answers are read back, and only for someone who already holds the officer
   * authority.
   */
  const reviewing =
    officer && Boolean(urlEmp) && urlEmp !== String(empCode ?? "").trim();

  // Asked for the officer too, and not only the learner. It is what says
  // whether the course in the URL is one of THEIR allotted courses, which is
  // half of the answer to whether they are sitting it or checking it over.
  const needsLookup = !authLoading && granted && Boolean(empCode);

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

  // Answered for this course, rather than left over from the last one.
  const answered = lookup.courseId === emoduleId;

  /** This course is allotted to the signed-in employee, officer or not. */
  const enrolled = answered && lookup.status !== null;

  let checking = false;
  let allowed = false;

  if (authLoading) {
    checking = true;
  } else if (!granted) {
    // No grant means the address bar, not a link — refused for everyone.
    allowed = false;
  } else if (!empCode) {
    allowed = false;
  } else if (!answered || (officer && urlEmp === null)) {
    // Officers wait for the lookup as well. They are allowed either way, but
    // until it lands nothing knows whether the page should be recording what
    // they do on it, and rendering it as a learner's first would write ticks
    // against a course they are only checking over.
    //
    // They wait on the address too, for the same reason: until it is known
    // whether it names another employee, a review of somebody's attempt would
    // paint once as the officer's own sitting of the module.
    checking = true;
  } else {
    // Every module is the officer's to open, whether or not it was ever
    // allotted to them — that is what their ALL MODULES list and their COURSE
    // STATUS screen both link into.
    allowed = officer || enrolled;
  }

  /**
   * Looking at the course rather than sitting it: nothing is ticked off, no
   * paper can be answered, and no progress is reported.
   *
   * True of an officer on a module that is not theirs to sit — someone else's
   * course reached from COURSE STATUS, or any module from their own list — and
   * true as well when they came in to manage one, even one allotted to them,
   * because that entry is about the module and not about their own attempt at
   * it. False for the officer who opened one of their own allotted courses
   * from their USER dashboard: on that page they are a learner like any other.
   *
   * `reviewing` is the third reason, and it is not covered by the other two:
   * a module allotted to the officer as well as to the employee they came to
   * check made `enrolled` true, and COURSE STATUS carries no ?from=officer to
   * make `canManage` true, so the page rendered as the officer's OWN attempt at
   * that module — their answers instead of the employee's, the lecture gates
   * switched on against per-browser ticks they had never earned, and a live
   * "Start assignment" where a finished paper should have been. Which module is
   * also theirs has no bearing on whose attempt they came to read.
   */
  const preview = officer && (canManage || !enrolled || reviewing);

  // The quarter has lapsed: the course stays readable, but nothing may be
  // submitted against it. Never true of a module open to be managed, which is
  // not being submitted to in any case — that page is a read-only preview.
  const overdue =
    !preview && answered && lookup.status === COURSE_STATUS.OVERDUE;

  /**
   * The course is raised for a quarter that has not started yet.
   *
   * It is assigned, and it sits in PENDING from the day it is created, so the
   * learner can see what is coming. There is nothing to do in it until its
   * quarter opens, though, so until then it may not be entered at all — unlike
   * an overdue course, which stays readable.
   *
   * A module open to be managed is exempt for the same reason it is exempt
   * from `overdue`: that page is a read-only preview and nothing is submitted
   * from it, so a course the officer raised for next quarter must still be
   * theirs to check. The gate applies to them as normally as to anyone else on
   * a course they opened from their own dashboard to sit.
   */
  const locked = !preview && enrolled && isQuarterUpcoming(lookup.kraQuarter);

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
    /**
     * The course is being looked at, not sat. Every read-only branch on the
     * course pages keys on this, so that merely holding the officer authority
     * is not enough to turn a learner's own course into a preview.
     */
    preview,
    /**
     * The officer may edit this module and read its history — reserved for the
     * ALL MODULES list they came in through. Deliberately not the same flag as
     * `preview`: an officer reading someone else's course from COURSE STATUS
     * gets the read-only page without the editing that screen never offered.
     */
    canManage,
    overdue,
    locked,
    // "01-04-2026" — the day it opens, for the notice that says so.
    unlocksOn: locked ? quarterStartLabel(lookup.kraQuarter) : "",
    /**
     * Sittings left on a course handed back after a grade C — 0 once they have
     * all been used, and 0 as well on a course that never came back. `retakes`
     * below is what tells those two apart. A module open to be managed carries
     * no attempt of anyone's, so it is always 0 there.
     */
    attemptsLeft: !preview && answered ? lookup.attemptsLeft : 0,
    /**
     * How many times this course has been handed back — 0 on a first sitting.
     *
     * Which sitting the learner is on, in other words, and so which set of
     * per-browser progress belongs to them: the watched ticks and the
     * answered-question sets are keyed on it, so a returned course starts
     * from nothing rather than inheriting the last attempt's ticks.
     */
    retakes: answered ? lookup.retakes : 0,
  };
}
