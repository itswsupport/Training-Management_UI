# syntax=docker/dockerfile:1

# ETMS training UI — Next.js 16 (App Router), served from /etms.
#
# Built in three stages so the shipped image carries the compiled server and
# nothing else: no source, no dev dependencies, no npm cache.

ARG NODE_VERSION=22.17.1

# ---------------------------------------------------------------------------
# deps — node_modules only, so a source-only change does not reinstall
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — compiles the app
#
# ETMS_BACKEND_ORIGIN is an ARG, not a runtime variable, and that is not a
# choice: `next.config.mjs` reads it inside rewrites(), and Next resolves the
# config at build time and writes it into the server manifest. Pointing the
# image at a different backend therefore means rebuilding, not restarting.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

ARG ETMS_BACKEND_ORIGIN=http://localhost:8096/trainingmodule
ENV ETMS_BACKEND_ORIGIN=${ETMS_BACKEND_ORIGIN}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# runner — what actually ships
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Without this the standalone server binds to localhost and is unreachable
# from outside the container.
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# The standalone build is a self-contained server plus a trimmed node_modules.
# `public` and `.next/static` are not copied into it by next build, so they are
# added here — without them every asset under /etms/_next/static 404s.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Node 22 has fetch built in, so this needs no curl in the image. The login
# page is public, so it answers 200 without a session.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/etms/Login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
