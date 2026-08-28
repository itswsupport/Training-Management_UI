"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import CertificateSheet from "@/components/certificate/CertificateSheet";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { alerts } from "@/lib/alerts";
import { decodeId } from "@/lib/courseId";
import { certValues, downloadCertificate } from "@/lib/certificate";
import { getEmpCode } from "@/lib/permissions";
import { getCompletedCourse } from "@/services/UserCourseService";

function Unavailable({ children }) {
  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px] mx-auto max-w-md">
        {/* Header */}
        <div className="bg-[#dc3545] px-4 py-2">
          <h2 className="text-white font-bold uppercase tracking-wide">
            Certificate Unavailable
          </h2>
        </div>
        <div className="p-3 text-center">
          <p className="normal-case text-gray-700">{children}</p>
        </div>
      </div>
    </div>
  );
}

function CertificateBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const empCode = getEmpCode(user);

  const id = decodeId(searchParams.get("id"));
  const shouldPrint = searchParams.get("print") === "1";

  const [state, setState] = useState({ status: "loading" });
  // Blocks a second click while the artwork loads and the PDF is written.
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!empCode || !Number.isFinite(id)) {
      setState({ status: "missing" });
      return undefined;
    }
    let cancelled = false;

    (async () => {
      try {
        // The name / course / date / grade are read from the signed-in
        // employee's own COMPLETED record — never from the URL. Changing
        // "?id=" to a course they have not completed yields no certificate.
        const course = await getCompletedCourse(empCode, id);
        if (cancelled) return;
        setState(course ? { status: "ready", course } : { status: "missing" });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: apiErrorMessage(
              err,
              "Something went wrong loading this certificate."
            ),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [empCode, id, authLoading]);

  // Auto-print once the artwork is on screen (the "download" action).
  useEffect(() => {
    if (state.status !== "ready" || !shouldPrint) return undefined;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [state.status, shouldPrint]);

  if (authLoading || state.status === "loading") {
    return (
      <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
        <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3482AE]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") return <Unavailable>{state.message}</Unavailable>;

  if (state.status === "missing") {
    return (
      <Unavailable>
        No certificate is available for this course. You can only view a
        certificate for a course you have completed.
      </Unavailable>
    );
  }

  // Built by the same function the download uses, off the same record — the
  // sheet on screen and the PDF it writes cannot say different things.
  const values = certValues(state.course);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadCertificate(values);
    } catch (err) {
      alerts.toast.error(
        err?.message || "Could not build the certificate. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  // The certificate is a screen of the application now rather than a tab of its
  // own, so "cancel" is simply the way back to the list that opened it. Stepping
  // back rather than pushing the dashboard keeps the employee's filters and
  // their page of the table, which a fresh navigation would reset.
  const handleCancel = () => router.back();

  return (
    <div className="flex min-h-full flex-1 justify-center bg-gray-200 p-4 print:block print:bg-white print:p-0">
      {/* `m-auto` rather than `items-center`: auto margins centre the sheet in
          the space it has but collapse instead of clipping its top edge when
          the viewport is shorter than the certificate. */}
      <div className="m-auto w-full max-w-4xl print:m-0">
        {/* Only the sheet scrolls sideways on a narrow screen — the buttons
            below it stay centred in the viewport. */}
        <div className="overflow-x-auto print:overflow-visible">
          <CertificateSheet
            values={values}
            className="min-w-[640px] shadow-lg print:min-w-0 print:shadow-none"
          />
        </div>

        {/* Actions sit under the sheet and stay off the printed page. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 print:hidden">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded bg-[#3482AE] px-6 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-[#2a6a8f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? "PREPARING…" : "DOWNLOAD"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-gray-400 bg-white px-6 py-2 text-sm font-semibold text-gray-700 shadow transition-colors hover:bg-gray-100"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CertificatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-gray-200 p-4">
          <p className="text-sm text-gray-600">Loading certificate…</p>
        </div>
      }
    >
      <CertificateBody />
    </Suspense>
  );
}
