/**
 * The payroll-ui colour palette, in one place.
 *
 * These are the literal hex values payroll-ui uses across StatusCard,
 * DynamicCard, FormActions and MaterialTableTheme. Every screen in this app
 * pulls its accents from here so the two products read as one system.
 */

/** Brand teal — headers, primary buttons, links, ID pills. */
export const BRAND = "#3482AE";
/** Brand teal, pressed/hover. */
export const BRAND_DARK = "#2a6a8f";
/** Brand teal, tinted background (row hover, subtle fills). */
export const BRAND_TINT = "#eaf3f9";

/** Solid status colours, for tiles and panel header bars. */
export const PENDING = "#ffc107";
export const APPROVED = "#20c997";
export const REJECTED = "#dc3545";
/** The cancel-button red (payroll FormActions). */
export const DANGER = "#f23a4c";
/** Disabled / not-applicable grey. */
export const MUTED = "#adb5bd";

/** Page background behind every screen (payroll `bg-[#f4f6f9]`). */
export const PAGE_BG = "#f4f6f9";
/** Table header fill — payroll's exoTheme sets MuiTableCell.head to this. */
export const TABLE_HEAD_BG = "#f5f5f5";

/**
 * The four dashboard tile colours, in payroll's order: blue, amber, green, red.
 * Used by status cards, action cards and the matching panel header bars.
 */
export const CARD_COLORS = {
  blue: BRAND,
  amber: PENDING,
  green: APPROVED,
  red: REJECTED,
};

/** Tailwind background classes for the same four, for `StatusCard`'s `color`. */
export const CARD_BG = {
  blue: "bg-[#3482AE]",
  amber: "bg-[#ffc107]",
  green: "bg-[#20c997]",
  red: "bg-[#dc3545]",
};

/**
 * Status chip config, per payroll's `getStatusConfig` convention — one fixed
 * colour per state so a status reads the same in every module.
 */
export const STATUS_CONFIG = {
  pending: { color: "#f59e0b", bg: "#fef3c7", label: "PENDING" },
  approved: { color: "#10b981", bg: "#d1fae5", label: "APPROVED" },
  rejected: { color: "#ef4444", bg: "#fee2e2", label: "REJECTED" },
  draft: { color: "#6b7280", bg: "#f3f4f6", label: "DRAFT" },
  submitted: { color: "#3b82f6", bg: "#dbeafe", label: "SUBMITTED" },
};
