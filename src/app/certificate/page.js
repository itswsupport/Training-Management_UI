"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { alerts } from "@/lib/alerts";
import { decodeId } from "@/lib/courseId";
import {
  CERT_ARTWORK,
  CERT_ASPECT,
  CERT_FIELDS,
  CERT_INK,
  downloadCertificate,
} from "@/lib/certificate";
import { getDisplayName, getEmpCode } from "@/lib/permissions";
import { getCompletedCourse } from "@/services/UserCourseService";

// Positions, ink and artwork are shared with the PDF download so the sheet on
// screen and the sheet in the file stay the same drawing.

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
        <div className="p-3 space-y-4 text-center">
          <p className="normal-case text-gray-700">{children}</p>
          <Link
            href="/UserDashboard"
            className="inline-block px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
          >
            BACK TO MY DASHBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}

function CertificateBody() {
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

  const { course } = state;
  const values = {
    name: (getDisplayName(user) || course.empName).toUpperCase(),
    course: course.name.toUpperCase(),
    date: course.regDate,
    grade: (course.grade || "").toUpperCase(),
  };

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

  // The certificate opens in a tab of its own, so "cancel" closes it. A tab the
  // employee opened themselves cannot be closed by script, so step back instead.
  const handleCancel = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) window.history.back();
    }, 100);
  };

  return (
    <div className="flex min-h-full flex-1 justify-center bg-gray-200 p-4 print:block print:bg-white print:p-0">
      {/* `m-auto` rather than `items-center`: auto margins centre the sheet in
          the space it has but collapse instead of clipping its top edge when
          the viewport is shorter than the certificate. */}
      <div className="m-auto w-full max-w-4xl print:m-0">
        {/* Only the sheet scrolls sideways on a narrow screen — the buttons
            below it stay centred in the viewport. */}
        <div className="overflow-x-auto print:overflow-visible">
          <div
            className="relative mx-auto block w-full min-w-[640px] shadow-lg print:min-w-0 print:shadow-none"
            style={{ containerType: "inline-size", aspectRatio: CERT_ASPECT }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CERT_ARTWORK}
              alt="Certificate of Training"
              className="absolute inset-0 h-full w-full"
            />
            {CERT_FIELDS.map((f) => (
              <span
                key={f.key}
                className="absolute whitespace-nowrap"
                style={{
                  left: `${f.left}%`,
                  top: `${f.top}%`,
                  transform: "translate(-50%, -50%)",
                  // `cqw` is a percentage of the sheet's own width — the same
                  // thing the PDF works out against its page width.
                  fontSize: `${f.size}cqw`,
                  fontWeight: f.weight,
                  color: CERT_INK,
                }}
              >
                {values[f.key]}
              </span>
            ))}
          </div>
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
          <Link
            href="/UserDashboard"
            className="rounded bg-[#20c997] px-6 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-[#1aa87f]"
          >
            BACK TO MY DASHBOARD
          </Link>
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
