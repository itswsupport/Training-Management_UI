"use client";

import React, { useCallback, useEffect, useState } from "react";

import ModuleForm from "./ModuleForm";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName, getEmpCode } from "@/lib/permissions";
import { getModuleFormOptions } from "@/services/MasterDataService";

/**
 * The Training Module form as the ADD MODULE tab's panel — it renders below the
 * tiles like any other panel on the dashboard.
 *
 * Dropdown master data is fetched when the panel mounts, so a screen that never
 * opens this tab never pays for those four requests.
 */
export default function ModuleFormPanel({ onSaved, onCancel }) {
  const { user } = useAuth();

  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setOptions(await getModuleFormOptions());
    } catch (err) {
      setOptions(null);
      setError(apiErrorMessage(err, "Failed to load the training module form"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  if (loading) {
    return (
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3482AE]"></div>
        </div>
      </div>
    );
  }

  if (error || !options) {
    return (
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <div className="text-red-500 p-4 text-center">
          {error}
          <button onClick={fetchOptions} className="ml-2 text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ModuleForm
      options={options}
      empCode={getEmpCode(user)}
      officerName={getDisplayName(user)}
      // Submitting already showed its own success dialog; the dashboard then
      // switches to ALL MODULES with the new module in it.
      onSuccess={onSaved}
      onCancel={onCancel}
    />
  );
}
