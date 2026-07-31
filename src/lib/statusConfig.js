/**
 * STANDARD STATUS CONFIGURATION
 *
 * The exact map from payroll-ui's `ExoMaterialTableExample` / the
 * MATERIAL_REACT_TABLE_GUIDE. Use it across all modules for consistency.
 */
export const getStatusConfig = (status) => {
  const statusMap = {
    0: { text: "PENDING", color: "#f59e0b", bgColor: "#fef3c7" },
    1: { text: "APPROVED", color: "#10b981", bgColor: "#d1fae5" },
    2: { text: "REJECTED", color: "#ef4444", bgColor: "#fee2e2" },
    3: { text: "DRAFT", color: "#6b7280", bgColor: "#f3f4f6" },
    4: { text: "SUBMITTED", color: "#3b82f6", bgColor: "#dbeafe" },
  };
  return (
    statusMap[status] || { text: "UNKNOWN", color: "#6b7280", bgColor: "#f3f4f6" }
  );
};

/**
 * ETMS course-completion status, which does not use the shared 0..4 scale:
 * 2 = completed, 3 = overdue, anything else = pending
 * (matches the legacy jsCourseCompletionList).
 */
export const getCourseStatusConfig = (status) => {
  if (status === 2) return { text: "COMPLETED", color: "#10b981", bgColor: "#d1fae5" };
  if (status === 3) return { text: "OVERDUE", color: "#ef4444", bgColor: "#fee2e2" };
  return { text: "PENDING", color: "#f59e0b", bgColor: "#fef3c7" };
};
