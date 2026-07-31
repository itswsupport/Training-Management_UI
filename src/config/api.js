/**
 * Centralized API Configuration
 *
 * Single source of truth for the ETMS (trainingmodule) backend base URL.
 * All API calls go through this instead of hardcoding URLs.
 *
 * Two conventions the Spring backend forces on every caller:
 *   1. No endpoint accepts a JSON body. Writes go over query params or
 *      form-encoding (@RequestParam / @ModelAttribute, never @RequestBody).
 *   2. Every response is HTTP 200. The real result is `status_code` in the
 *      body, so callers must branch on that — never on the HTTP status.
 *
 * Usage:
 *   import { api, API_BASE_URL, unwrap } from '@/config/api';
 *   const rows = unwrap(await api.get('/emodule/list'));
 */

import axios from "axios";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "/etms/api"
).replace(/\/+$/, "");

/** Backend response codes (IResponseCode). SERVER_ERROR is 501, not 500. */
export const ApiStatus = {
  SUCCESS: 200,
  DATA_NOT_FOUND: 204,
  UNAUTHORIZED: 401,
  SERVER_ERROR: 501,
};

/**
 * Build a full API URL.
 * @param {string} endpoint e.g. '/emodule/list'
 * @returns {string}
 */
export const getApiUrl = (endpoint) => {
  const clean = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${clean}`;
};

/** Shared axios instance. */
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
});

/**
 * Sends the session's token, on the day there is one.
 *
 * `LoginUser` declares a `token` field that nothing ever sets, so today every
 * call goes out unauthenticated — and every endpoint answers, because the
 * security config requires authentication on nothing. Attaching it here means
 * the browser side is already right when the backend starts issuing and
 * checking one; it costs nothing until then.
 */
api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  try {
    // Imported lazily: this module is loaded by server components too, and the
    // session lives in the browser.
    const { sessionToken } = require("@/lib/session");
    const token = sessionToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    /* no session, or storage is blocked — the call goes as it always did */
  }
  return config;
});

/**
 * Pulls `response` out of the backend envelope, throwing on a non-success
 * status_code so callers can use a plain try/catch.
 *
 * DATA_NOT_FOUND (204) is not an error — it means "no rows", so it yields the
 * supplied fallback (usually [] or null).
 *
 * @param {import('axios').AxiosResponse} res
 * @param {*} [fallback] value returned when the backend has no data
 */
export const unwrap = (res, fallback = null) => {
  const body = res?.data;
  if (!body || typeof body !== "object") {
    throw new Error("The training service returned an unexpected response.");
  }
  if (body.status_code === ApiStatus.DATA_NOT_FOUND) return fallback;
  if (body.status_code !== ApiStatus.SUCCESS) {
    throw new Error(body.message || "The training service returned an error.");
  }
  return body.response === undefined ? fallback : body.response;
};

/**
 * Normalises an axios/network failure into a message worth showing a user.
 * @param {unknown} err
 * @param {string} fallback
 */
export const apiErrorMessage = (err, fallback = "Something went wrong.") => {
  if (err?.response) {
    return (
      err.response.data?.message ||
      `The training service returned HTTP ${err.response.status}.`
    );
  }
  if (err?.request) return "Could not reach the training service.";
  return err?.message || fallback;
};

/**
 * Builds an application/x-www-form-urlencoded body. The backend binds writes
 * via @ModelAttribute / @RequestParam, and several params are arrays whose
 * names literally include "[]", so pass arrays as `['a','b']` values.
 *
 * @param {Record<string, string|number|Array<string|number>>} params
 * @returns {URLSearchParams}
 */
export const toFormBody = (params) => {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => body.append(key, String(v)));
    } else {
      body.append(key, String(value));
    }
  });
  return body;
};

/** POST/PUT a form-encoded write to the backend. */
export const sendForm = (endpoint, params, method = "post") =>
  api.request({
    url: endpoint,
    method,
    data: toFormBody(params),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

export default API_BASE_URL;
