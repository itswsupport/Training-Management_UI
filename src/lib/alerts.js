"use client";

import Swal from "sweetalert2";
import toast from "react-hot-toast";

import { APPROVED, BRAND, PENDING, REJECTED } from "./palette";

/**
 * Application alerts — SweetAlert2 dialogs and toasts, themed like payroll-ui:
 * Exo 12px, an uppercase title, a teal confirm button and a red cancel.
 *
 * payroll-ui calls `Swal.fire({...})` inline on every screen and repeats the
 * colours each time. Here the theme lives in one preconfigured instance so a
 * screen only has to say what happened:
 *
 *     await alerts.success("Module submitted successfully.");
 *     if (await alerts.confirm("Delete this question?")) …
 *     alerts.toast.success("Saved");
 */

const FONT = "var(--font-exo), sans-serif";

const themed = Swal.mixin({
  confirmButtonColor: BRAND,
  cancelButtonColor: REJECTED,
  confirmButtonText: "OK",
  buttonsStyling: true,
  reverseButtons: true,
  customClass: {
    popup: "etms-swal",
    title: "etms-swal-title",
    htmlContainer: "etms-swal-text",
    confirmButton: "etms-swal-btn",
    cancelButton: "etms-swal-btn",
  },
});

const fire = (options) => themed.fire({ ...options });

/** Green tick — an action completed. */
const success = (text, title = "Success!") =>
  fire({ icon: "success", title, text, iconColor: APPROVED });

/** Red cross — something failed. */
const error = (text, title = "Error") =>
  fire({ icon: "error", title, text, iconColor: REJECTED });

/** Amber "!" — the user needs to fix something before continuing. */
const warning = (text, title = "Warning") =>
  fire({ icon: "warning", title, text, iconColor: PENDING });

/** Plain teal "i" — neutral information. */
const info = (text, title = "Note") =>
  fire({ icon: "info", title, text, iconColor: BRAND });

/**
 * A yes/no question. Resolves `true` only when the user confirms, so it reads
 * as a guard: `if (!(await alerts.confirm("Delete this?"))) return;`
 *
 * Pass `danger` for destructive actions — the confirm button turns red.
 */
const confirm = async (
  text,
  {
    title = "Are you sure?",
    confirmText = "Yes",
    cancelText = "Cancel",
    danger = false,
  } = {}
) => {
  const result = await fire({
    icon: "question",
    title,
    text,
    iconColor: danger ? REJECTED : BRAND,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? REJECTED : BRAND,
    cancelButtonColor: "#6c757d",
  });
  return result.isConfirmed;
};

/** A blocking "working…" dialog. Close it with `alerts.close()`. */
const loading = (title = "Please wait…") =>
  themed.fire({
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });

const close = () => Swal.close();

const toastStyle = {
  fontFamily: FONT,
  fontSize: "12px",
  textTransform: "uppercase",
  borderRadius: "4px",
};

export const alerts = {
  fire,
  success,
  error,
  warning,
  info,
  confirm,
  loading,
  close,
  toast: {
    success: (message) =>
      toast.success(message, { style: toastStyle, duration: 3000 }),
    error: (message) =>
      toast.error(message, { style: toastStyle, duration: 5000 }),
    info: (message) => toast(message, { style: toastStyle }),
  },
};

export default alerts;
