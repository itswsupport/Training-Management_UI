"use client";

import { useEffect } from "react";

import { decodeId } from "@/lib/courseId";
import { grantCourseAccess } from "@/lib/courseGrant";

/** `/etms/course/<token>` or `/course/<token>`, with or without a sub-route. */
const COURSE_HREF = /\/course\/([a-z]+)(?:[/?#]|$)/;

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
      const token = COURSE_HREF.exec(href)?.[1];
      if (!token) return;

      const emoduleId = decodeId(token);
      if (Number.isFinite(emoduleId)) grantCourseAccess(emoduleId);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
