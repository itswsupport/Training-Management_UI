// Global color theme for status tabs/cards
// Usage: import { STATUS_COLORS, getStatusTabHeading } from "@/lib/statusTheme";

export const STATUS_COLORS = {
  apply: "bg-[#3482AE]",     // Blue
  pending: "bg-[#ffc107]",   // Yellow
  approved: "bg-[#20c997]",  // Green
  rejected: "bg-[#dc3545]",  // Red
};

export const getStatusTabHeading = (tabId, base = "STATUS") => {
  switch(tabId) {
    case 'apply': return `${base} - APPLY`;
    case 'pending': return `${base} - PENDING`;
    case 'approved': return `${base} - APPROVED`;
    case 'rejected': return `${base} - REJECTED`;
    default: return base;
  }
};
