"use client";

import { useEffect } from "react";

import { decodeId } from "@/lib/courseId";
import { grantCourseAccess } from "@/lib/courseGrant";

/**
 * `/etms/course/<token>` or `/course/<token>`, with or without a sub-route.
 *
 * The character after the token is captured too, because it says whether the
 * link enters the course or moves around inside one already open — see below.
 */
const COURSE_HREF = /\/course\/([a-z]+)([/?#]|$)/;

/**
 * Grants course access for every course link the user actually clicks.
 *
 * Mounted once at the layout, this saves threading a grant call through all
 * ~17 places that build a course URL, and it cannot be forgotten when a new
 * link is added later. Programmatic `router.push` navigations are not clicks
 * and still have to grant for themselves.
 *
 * Capture phase, so the grant is written before Next's router handles the click
 * and swaps the page out from under it.
 */
export function useCourseLinkGrants() {
  useEffect(() => {
    const onClick = (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      const match = COURSE_HREF.exec(href);
      if (!match) return;

      const emoduleId = decodeId(match[1]);
      if (!Number.isFinite(emoduleId)) return;

      // A link into the course decides which view it opens in; a link deeper
      // inside it — a lecture, a paper — carries no ?from= and must leave that
      // decision alone, or stepping into a lecture would drop an officer out of
      // their own edit view.
      const entering = match[2] !== "/";
      grantCourseAccess(
        emoduleId,
        entering ? { officer: /[?&]from=officer(?:&|$)/.test(href) } : undefined
      );
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
