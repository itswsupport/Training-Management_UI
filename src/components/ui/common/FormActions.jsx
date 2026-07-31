"use client";

import React from "react";

export default function FormActions({
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "APPLY",
  cancelLabel = "CANCEL",
}) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 flex justify-center mt-4">
        {/* Apply Button */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className={`px-6 py-2 bg-[#3482AE] hover:bg-[#2a6a8f] text-white rounded font-medium text-sm transition-colors shadow-md ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {isSubmitting ? "SUBMITTING..." : submitLabel}
        </button>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="ml-4 px-6 py-2 bg-[#f23a4c] hover:bg-red-700 text-white rounded font-medium text-sm transition-colors shadow-md cursor-pointer"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
