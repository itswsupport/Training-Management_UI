# REPL ETMS — Employee Training Management System

A Next.js 16 front end for the ETMS Spring backend (`trainingmodule`), built to
the same design language and project structure as `payroll-ui`, so a developer
moving between the two repos sees identical patterns.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000/etms
```

The app is served under the `/etms` base path (payroll uses `/payroll`).

### Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | What the browser calls | `/etms/api` |
| `ETMS_BACKEND_ORIGIN` | Where `/api/*` is rewritten to | `http://localhost:8096/trainingmodule` |
| `ETMS_TOKEN_SECRET_KEY` | AES-128 key for portal hand-off tokens, exactly 16 bytes. Server-only — never send it to the browser | `REPL_EOB_2024_SK` |
| `NEXT_PUBLIC_PORTAL_DASHBOARD_URL` | Where logout hands the user back to | `https://replportal.co.in:8443/portal/dashboard.jsp` |

The default keeps every request same-origin: the browser hits `/etms/api/...`,
and `next.config.mjs` rewrites it to the Spring backend, so there is no CORS
setup in development and an nginx reverse proxy handles it in production.

## Signing in from the portal

The REPL portal launches this app at `https://replportal.co.in/etms/<token>`,
where `<token>` is the portal's `encryptEmpCode()` output:

```
base64url( AES-128-CBC( "empCode|timestampMillis" ) ), IV = the key bytes
```

`src/app/[token]/page.js` receives it, `src/app/auth/decrypt-token/route.js`
decrypts it **on the server** (the key stays out of the client bundle, and
`crypto.subtle` does not exist on the plain-HTTP origin production is served
from), and the employee code that falls out is signed in through
`AuthService.loginWithEmpCode`. Tokens are refused after 10 minutes, measured
against the server clock.

The `/Login` password form is untouched and still works for anyone reaching the
app directly. Changing `ETMS_TOKEN_SECRET_KEY` requires the same change in the
portal's `encryptEmpCode()`, or every hand-off stops decrypting.

**Logging out** goes back the way the user came in: `LOGOUT` clears the session
and hard-navigates to `NEXT_PUBLIC_PORTAL_DASHBOARD_URL` (the portal dashboard),
since the app the user is leaving is not the one that signed them in. A session
that simply times out still lands on `/Login`.

## Structure

```
src/
  app/                        route segments (App Router, all client components)
    Login/                    sign-in
    UserDashboard/            learner: pending / in-process / completed / overdue
    TrainingOfficerDashboard/ officer: modules, moduleForm, courseStatus, feedbackForm
    course/[id]/              course detail, assignment/[sectionId], feedback
    certificate/              certificate of training
  components/
    ui/            shadcn primitives (sidebar, sheet, tooltip, button, input…)
    ui/common/     the shared kit: Button, Card, Form, Table, PageTitle,
                   DataGrid, Panel, Badge, MultiSelect, SearchableSelect
    ui/themes/     MaterialTableTheme (Exo 12px MUI theme)
    cards/         dashboard status tiles
    course/        course detail, content tree, assignment + feedback forms
    dashboards/    the data grids
    modules/       the officer's module builder
    feedback/      the officer's feedback question bank
    app-sidebar.jsx, ProtectedLayout.jsx, ScrollFooter.jsx, StatusCard.jsx
  config/api.js    axios instance, envelope unwrapping, form-encoded writes
  context/         AuthContext (localStorage session)
  hooks/           use-mobile
  lib/             utils, permissions, palette, alerts, tableExport
  services/        one module per backend domain
  utils/           formatting helpers
```

## Backend conventions

The Spring backend imposes two rules every service in `src/services` follows:

1. **No endpoint accepts a JSON body.** Writes go over query params or
   form-encoding (`@RequestParam` / `@ModelAttribute`). `config/api.js` exposes
   `sendForm()` for this.
2. **Every response is HTTP 200.** The real result is `status_code` in the body,
   so `unwrap()` branches on that — `204` means "no rows", not an error.

## Roles

The backend grants exactly one of `TRAINING OFFICER`, `HOD`, `USER`. Route
access is declared in `src/lib/permissions.js` and enforced by
`ProtectedLayout`; a user with no authority is refused at login rather than
crashing a dashboard.

## Known constraints inherited from the backend

- `/login` **does not verify the password** — the controller discards its own
  comparison, so any password is accepted for an existing employee code.
- `/login` returns the stored bcrypt hash in its payload (the field has no
  `@JsonIgnore`). `AuthService.login` strips it before anything is persisted.
- `/quiz/list` serialises the raw entity, so the assignment answer key
  (`quaAnswer`) is on the wire. `AssignmentService` drops it from the mapped
  result, but hiding it properly needs a backend projection.
- `/submit_exam/save` has a read-then-insert race with no unique constraint, so
  `AssignmentForm` serialises answer saves through a promise queue.
- `/feedback/save` is not idempotent — a second submit recalculates the grade,
  so the form checks `isFeedbackDue` before opening.
- `/user_module1/by_status` returns the entire dataset (~4.6 MB, no paging);
  `CourseStatusService` caches it in-tab for a minute.
- The module draft slot is global (`findByStatus(0)`), so `saveModule` reuses
  the current draft id and clears its leftover sections.

## Deployment

Live at `https://replportal.co.in/etms/` on `206.189.134.85`, built by Jenkins
into a Docker image and run behind nginx. ETMS is independent of the dashboard
hub ecosystem — its own login, its own roles, no shared JWT and no hub tile.

| | UI (this repo) | Backend (`REPL-IT-Projects/etms`) |
|---|---|---|
| Image / container | `etms-ui` | `etms-backend` |
| Host port | `3020` → 3000 | `8096` → 8096 |
| Jenkinsfile | `Jenkinsfile` | `etms/Jenkinsfile` |

`ETMS_BACKEND_ORIGIN` is a **build** argument, not a runtime variable:
`next.config.mjs` reads it inside `rewrites()`, and Next resolves the config at
build time and writes it into the server manifest. Pointing the image at a
different backend requires a rebuild, not a restart. It defaults to
`http://172.17.0.1:8096/trainingmodule` — the docker0 gateway, i.e. the host,
where the backend publishes 8096; never `localhost`, which inside the container
is the container itself.

`basePath` and `assetPrefix` are both `/etms`, so nginx must proxy to
`http://127.0.0.1:3020/etms/` **with** the prefix rather than stripping it.

See [deploy/RUNBOOK.md](deploy/RUNBOOK.md) for the full procedure, and
[deploy/nginx-etms.conf](deploy/nginx-etms.conf) for the server block — its
`client_max_body_size 1024m` is required, or video uploads 413 at the proxy
before reaching the 1GB limits configured in the app and the backend.
