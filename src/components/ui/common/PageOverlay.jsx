"use client";

import React, { useEffect } from "react";
import { ChevronLeft } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";

/** SIDEBAR_WIDTH in components/ui/sidebar. */
const SIDEBAR_WIDTH = "16rem";
/** The app header's `minHeight` in ProtectedLayout. */
const APP_HEADER_HEIGHT = 44;

/**
 * A full-page overlay that fills the content region: it starts at the sidebar's
 * right edge and below the app header, so both stay visible and usable while
 * the overlay takes the rest of the page.
 *
 * Laid out like any other payroll page — tinted field, plain teal heading,
 * BACK on the right — so a form opened in an overlay reads the same as one
 * opened on its own route.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title shown as the page heading
 * @param {Function} props.onBack the BACK button and Esc both call this
 * @param {number} [props.zIndex] raise it for an overlay opened from another
 *   overlay (the Add Question form over the Feedback Form)
 */
export default function PageOverlay({ open, title, onBack, zIndex = 50, children }) {
  // The sidebar collapses off-canvas, and is a Sheet on mobile — in both of
  // those the content region starts at the viewport edge.
  const { state, isMobile } = useSidebar();
  const leftOffset = isMobile || state === "collapsed" ? 0 : SIDEBAR_WIDTH;

  // The page behind the overlay must not scroll while it is up.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc leaves, via the same guarded path as the BACK button.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onBack?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onBack]);

  if (!open) return null;

  return (
    <div
      className="fixed right-0 bottom-0 flex transition-[left] duration-200"
      style={{ left: leftOffset, top: APP_HEADER_HEIGHT, zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-[#f5f8fa] w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between mx-6 my-4 shrink-0">
          <h1 className="text-[16px] font-bold text-[#3482AE] uppercase tracking-wide">
            {title}
          </h1>
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-4 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> BACK
          </button>
        </header>

        {/* Body */}
        <div className="px-4 pb-4 overflow-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
