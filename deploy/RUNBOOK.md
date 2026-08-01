# ETMS deployment runbook

Getting `https://replportal.co.in/etms/` live on `206.189.134.85`.

ETMS is **independent of the dashboard hub**. It has its own login and its own
`TRAINING OFFICER` / `HOD` / `USER` roles, it is not registered in the hub's
`ALL_DASHBOARDS`, and it does not use the shared `dash_auth_token` JWT. Nothing
under `d:\Rishikesh\dashboards` needs to change.

## What gets deployed

| | UI | Backend |
|---|---|---|
| Repo | `itswsupport/Training-Management_UI` | `REPL-IT-Projects/etms` |
| Branch | `master` | `master` |
| Jenkinsfile path | `Jenkinsfile` | **`etms/Jenkinsfile`** (repo root is an Eclipse workspace) |
| Image / container | `etms-ui` | `etms-backend` |
| Host port | `3020` → 3000 | `8096` → 8096 |
| Public path | `/etms` | not exposed — reached container-side only |
| Stack | Next.js 16, standalone output | Spring Boot 2.7, Java 11, executable war |

Both ports were free at the time of writing: fleet UIs run 3000–3017 and
backends 9097–9099. **Re-check before you start** — the fleet's
`SERVER-INVENTORY.md` is stale and does not list 3015–3017.

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | sort
ss -ltn | grep -E ':(3020|8096) '     # expect no output
```

## 1. Jenkins credentials

The backend pipeline needs exactly **one** credential:

| ID | Kind | Contents |
|---|---|---|
| `etms-db` | Username with password | The MySQL account for `db_ems_version2` on `172.17.0.1:3309` |

The UI pipeline needs none.

For repository checkout both jobs use `ui-payroll`, the credential the fleet
already uses for `itswsupport/*` repos. Both ETMS repos are private and reachable
only through the `itswsupport` account — run one manual build of each job and
confirm checkout succeeds before wiring the webhooks. If the backend checkout
fails, try `payroll-backend` instead, which is what `REPL-IT-Projects/payRoll`
uses.

## 2. Create the two jobs

```bash
java -jar jenkins-cli.jar -s http://<jenkins>/ create-job etms-backend < jenkins-job-etms-backend.xml
java -jar jenkins-cli.jar -s http://<jenkins>/ create-job etms-ui      < jenkins-job-etms-ui.xml
```

`jenkins-job-etms-backend.xml` lives in the backend repo at `etms/deploy/`;
`jenkins-job-etms-ui.xml` is next to this file.

Or create two Pipeline jobs by hand — *Pipeline script from SCM*, Git, the repo
URL, `*/master`, credential `ui-payroll`, and the script path from the table
above. The backend's script path is **not** the default `Jenkinsfile`.

## 3. Build the backend first

Run `etms-backend`. Defaults are production-ready:

- `HOST_PORT` `8096`
- `DB_URL` `jdbc:mysql://172.17.0.1:3309/` (trailing slash is required — the
  profile composes the url as `${DB_URL}${DB_NAME}`)
- `DB_NAME` `db_ems_version2`
- `UPLOAD_DIR` `/srv/etms/upload` — bind-mounted at `/upload`. Training videos
  and material files live here. **Get this right the first time**: it is created
  if missing, but pointing it somewhere else later orphans everything already
  uploaded.
- `DOCKER_NETWORK` blank (default bridge)

The pipeline builds the war inside the image, so the agent needs Docker only —
no JDK, no Maven.

## 4. Build the UI

Run `etms-ui`. Defaults:

- `HOST_PORT` `3020`
- `ETMS_BACKEND_ORIGIN` `http://172.17.0.1:8096/trainingmodule`

`ETMS_BACKEND_ORIGIN` is consumed at **build** time, not run time —
`next.config.mjs` reads it inside `rewrites()` and Next bakes it into the server
manifest. Changing which backend the UI talks to means rebuilding the image, not
restarting the container.

`172.17.0.1` is the docker0 gateway, i.e. the host, where the backend publishes
8096. This works with both containers on the default bridge and no shared
network. If you would rather they talk by container name, create a network, set
`DOCKER_NETWORK` on **both** jobs, and set `ETMS_BACKEND_ORIGIN` to
`http://etms-backend:8096/trainingmodule` — but note that a user-defined bridge's
gateway is not `172.17.0.1`, so the backend then needs
`--add-host=host.docker.internal:host-gateway` to keep reaching MySQL.

## 5. Wire nginx

Find the live server block — the config in this repo is a fragment, and the real
one on the host terminates TLS:

```bash
nginx -T | grep -n -A5 'server_name replportal.co.in'
```

Paste the contents of `nginx-etms.conf` into the block serving
`replportal.co.in` on 443, then:

```bash
nginx -t && systemctl reload nginx
```

The `client_max_body_size 1024m` in that block is load-bearing. nginx defaults to
1m and would reject video uploads with a 413 before the request reached the app,
even though both later hops are already configured for 1GB.

## 6. Webhooks

Add a webhook on both GitHub repos pointing at
`http://<jenkins-host>/github-webhook/` (content type `application/json`, push
events). Both Jenkinsfiles declare `triggers { githubPush() }`, which registers
once the job has built at least once — so do this after step 3 and 4.

## Verify

```bash
docker ps --filter name=etms          # both Up and (healthy) — not merely Up
curl -I https://replportal.co.in/etms/Login    # 200
curl -I https://replportal.co.in/etms          # 301 -> /etms/
docker logs --tail 50 etms-backend
docker logs --tail 50 etms-ui
```

The backend healthcheck calls a real login endpoint, so `(healthy)` means the
database is genuinely reachable. If it sits `(unhealthy)`, the credentials in
`etms-db` or the `DB_URL`/`DB_NAME` pair are wrong — check `docker logs`.

Then in a browser:

1. Log in at `https://replportal.co.in/etms/Login` with a real employee code.
2. Confirm role-gated routes render (`ProtectedLayout`, `src/lib/permissions.js`).
3. Open devtools and confirm every asset loads from `/etms/_next/...` with no
   404s — an asset 404 means `basePath`/`assetPrefix` did not survive the build.
4. **Upload a training video over 100 MB.** This is the check that exercises the
   whole chain: nginx `client_max_body_size` → Next.js `proxyClientMaxBodySize`
   → Spring `spring.servlet.multipart.max-request-size`. A 413 means step 5 did
   not take.
5. Confirm the uploaded file appears under `/srv/etms/upload/trainingemodule/`
   on the host, not just inside the container.

Finally push a trivial commit to `master` on each repo and confirm Jenkins fires
without a manual trigger.

## Rollback

Images are tagged with the build number:

```bash
docker images etms-ui        # or etms-backend
docker rm -f etms-ui
docker run -d --name etms-ui --restart unless-stopped -p 3020:3000 etms-ui:<previous-build-number>
```

The backend additionally needs its `--env-file` and `-v /srv/etms/upload:/upload`
— easiest is to re-run the previous Jenkins build rather than reconstructing the
command by hand.

## Known issues, not fixed here

- **The backend does not verify passwords.** `/trainingmodule/login` accepts any
  password for an existing employee code — the controller computes a comparison
  and discards it. This was survivable on a LAN; on a public host it means anyone
  who knows an employee code has that person's access. This is a code fix in the
  backend, out of scope for the deployment work, and should be filed before wider
  rollout.
- `jwt.secret` and a MySQL password are committed in
  `src/main/resources/application.properties`. The `prod` profile overrides the
  database credentials from the environment, so the committed ones are dev
  defaults — but they are real credentials in git history and worth rotating.
  Nothing currently reads `jwt.secret` (only `jwt.key-length` is injected).
- `spring.jpa.hibernate.ddl-auto=update` — Hibernate alters the schema on every
  boot. A container restarts far more often than a hand-started service; worth
  moving to `validate` once the schema settles.
- Mail is disabled: `spring.mail.host` is the literal string `null`. Any feature
  that sends mail will fail at runtime.
- ETMS ports 3020 and 8096 are not recorded in the fleet's
  `SERVER-INVENTORY.md`. ETMS is deliberately outside that ecosystem, but that
  file is the only port registry the fleet has, so a future project could claim
  these ports unaware.
