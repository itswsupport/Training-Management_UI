"use client";

import { useId } from "react";

/**
 * The manual's colour helpers and its one piece of decoration.
 *
 * Inline SVG for the hero backdrop: it stays sharp on any screen and costs no
 * request on a page people open once and read.
 */

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/**
 * Mixes a hex colour toward black or white.
 *
 * @param {string} hex e.g. "#3482AE"
 * @param {number} amount -1 (black) … 1 (white)
 */
export function shade(hex, amount) {
  const value = String(hex).replace("#", "");
  const full =
    value.length === 3
      ? value.split("").map((c) => c + c).join("")
      : value;
  const num = parseInt(full, 16);
  const mix = (channel) => {
    const target = amount < 0 ? 0 : 255;
    const t = Math.abs(amount);
    return Math.round(channel + (target - channel) * t);
  };
  const r = mix((num >> 16) & 255);
  const g = mix((num >> 8) & 255);
  const b = mix(num & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** A left-to-right gradient for a card header, tile or pill. */
export const gradient = (hex, angle = 135) =>
  `linear-gradient(${angle}deg, ${shade(hex, 0.12)} 0%, ${hex} 45%, ${shade(hex, -0.28)} 100%)`;

/* ------------------------------------------------------------------ */
/* Hero backdrop                                                       */
/* ------------------------------------------------------------------ */

/**
 * The dotted grid and soft blooms behind the hero. Purely decorative, so it is
 * hidden from assistive technology.
 */
export function HeroPattern() {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 400"
    >
      <defs>
        <pattern
          id={`${id}-dots`}
          width="26"
          height="26"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.6" fill="#ffffff" opacity="0.14" />
        </pattern>
        <radialGradient id={`${id}-bloom`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="400" fill={`url(#${id}-dots)`} />
      <circle cx="120" cy="70" r="190" fill={`url(#${id}-bloom)`} />
      <circle cx="1080" cy="350" r="220" fill={`url(#${id}-bloom)`} />
      {/* A pair of soft diagonals, echoing the card headers' sheen. */}
      <path
        d="M-60 400 L400 -40 L520 -40 L60 400 Z"
        fill="#ffffff"
        opacity="0.05"
      />
      <path
        d="M700 400 L1160 -40 L1220 -40 L760 400 Z"
        fill="#ffffff"
        opacity="0.04"
      />
    </svg>
  );
}

export default HeroPattern;
