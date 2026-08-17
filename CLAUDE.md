# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Speedhawk audits a website's performance: the client submits a URL, the server enqueues a job, and a worker runs Lighthouse + Puppeteer against the URL and asks Gemini for improvement suggestions. Results land in Postgres and the client polls for them.

## Repo layout / package boundaries

Three **independent** npm packages — there is no root `package.json` and no workspace linking. Run `npm install` and every script from inside `client/`, `server/`, or `worker/`. `shared/` is not a package; it only holds the RDS TLS cert bundle.

## Commands

```bash
# Everything at once (root) — client :5173, server :3001, worker (no port)
docker compose up            # add --build after dependency changes

# Per package (from client/, server/, or worker/)
npm run dev                  # vite / nodemon src/server.js / nodemon src/worker.js
npm start                    # server + worker only, production entry

# Tests — the two backends use different runners
cd server && npm test                                   # vitest
cd server && npx vitest run src/tests/urlValidate.test.js
cd worker && npm test                                   # node:test, all src/tests/*.test.js
cd worker && node --experimental-test-module-mocks --test src/tests/processAudit.test.js

# Connectivity smoke checks (server/)
npm run test:db              # SELECT NOW() through the pg pool
npm run test:redis           # loads the Upstash ratelimit config

# Lint (client only — no linter is configured for server/worker)
cd client && npm run lint

# Migrations (goose, from server/)
goose -dir internal/database/migrations postgres "$DATABASE_URL" up
```

`worker/` relies on `--experimental-test-module-mocks` to swap out the pg pool, Puppeteer, Lighthouse, and Gemini — a plain `node --test` run of those files will fail.

## Infrastructure is remote, even locally

`docker-compose.yml` starts only client/server/worker. **Postgres and Redis are always remote** (AWS RDS + Upstash), so a working `.env` is required to run anything:

- `server/.env` and `worker/.env` — copy from each `.env.example`; both need `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `UPSTASH_REDIS_REST_TOKEN`. The worker also needs `GEMINI_API_KEY`; the server also needs `UPSTASH_REDIS_REST_URL` (used by `@upstash/redis` for rate limiting) and `CORS_ORIGIN`.
- `client/.env` — `VITE_API_BASE_URL`, **baked in at build time** (defaults to `http://localhost:3001`).

Both `config/database.js` files resolve the RDS CA bundle at the hardcoded relative path `../../../shared/certs/global-bundle.pem` with `rejectUnauthorized: true`. Compose bind-mounts `./shared/certs` to `/shared/certs`, and `worker/Dockerfile` copies it there — which is why the worker image **builds from the repo root**, not from `worker/` (see `dockerContext: ..` in `render.yaml`).

## Architecture

```
client (React/Vite)  ──POST /api/audits──►  server (Express)  ──BullMQ "audits"──►  Redis
       ▲                                          │                                   │
       └──poll GET /api/audits/:id────────────► Postgres ◄────writes results──── worker (Lighthouse/Puppeteer/Gemini)
```

The **only** contract between server and worker is the BullMQ queue named `audits`, job name `process-audit`, payload `{ auditId, url }`, enqueued with `attempts: 2` and exponential backoff. Both sides build their own Redis connection object (`server/src/config/queue.js`, `worker/src/config/queue.js`) — a change to connection options must be mirrored in both.

The worker runs `concurrency: 1` with a limiter of 10 jobs per 6s. Puppeteer launches Chromium (`CHROME_BIN`, `/usr/bin/chromium` in the image), navigates for DOM metadata, and Lighthouse attaches to that same browser's debug port.

### Audit status machine

`audits.status` is what the client polls on, so every failure path must leave a terminal value. Three separate mechanisms in `worker/src/processors/auditProcessor.js` and `worker/src/worker.js` guarantee that:

- `processAudit` catch block — on the **last** attempt sets `failed`; if retries remain it reverts to `pending` so the client keeps polling instead of giving up.
- `markOrphanedAuditFailed` — bound to BullMQ's `failed` event, covers jobs the queue fails internally (stalled/crashed) which never re-enter `processAudit`. Idempotent: only flips non-terminal rows.
- `sweepStuckAudits` — `setInterval` every 5 min, fails rows still `running` after 15 min.

Each attempt deletes prior `metrics`/`suggestions` rows for the audit before rerunning, so retries stay idempotent.

The client (`client/src/components/Audit.jsx`) polls every 2s for a max of 60 attempts (120s) before showing a timeout.

### Suggestions contract

`type` must be one of `performance | bundle | image | rendering` and `impact` one of `high | medium | low`. This enum is duplicated in four places — changing it means touching all of them:

1. the Gemini prompt in `auditProcessor.js`
2. `VALID_TYPES` / `VALID_IMPACTS` in `worker/src/utils/validateSuggestions.js`
3. `getFallbackSuggestions()` in the same file
4. `typeBadge` / `impactBadge` in `client/src/utils/auditHelpers.js`

If Gemini fails, returns non-JSON, or every suggestion fails validation, `getFallbackSuggestions()` produces rule-based ones from the raw metrics. **An audit always completes with at least one suggestion** — tests assert this.

### Schema

Goose migrations in `server/internal/database/migrations/` are the source of truth. `server/src/db/schema.sql` is a stale reference doc — do not treat it as authoritative and do not run it.

Adding a metric requires a new goose migration, the extraction + INSERT column list in `auditProcessor.js`, and a row in `MetricsCard` in `client/src/components/Audit.jsx`. Metric definitions, Lighthouse sources, and thresholds are documented in `docs/README.md`.

## Conventions

- ESM everywhere (`"type": "module"`), `.js`/`.jsx` — no TypeScript.
- The server logs through winston (`server/src/utils/logger.js`) with custom levels `critical | error | info`; the worker logs with plain `console.log`/`console.error` prefixed `[Job ${job.id}]`.
- Rate limiting is per-IP via Upstash: `strictRateLimiter` (2 per 30s) on `POST /api/audits`, `generousRateLimiter` (60 per 60s) on `GET /api/audits/:id`. A shared in-memory `ephemeralCache` short-circuits flagged IPs to keep Upstash command spend down; if the limiter itself throws, requests are rejected with 503 rather than allowed through.
- URLs are normalized (bare hostnames get `https://`) then validated in `server/src/utils/urlValidate.js` before an audit row is created.
- Styling is Tailwind v4 (via `@tailwindcss/vite`) + daisyUI classes; no separate tailwind config file.
- Do NOT use em dashes anywhere.

## Deploy

`render.yaml` defines three Render services: server (node, `rootDir: server`, health check `/health`), worker (docker, built from repo root), and client (static, `dist/`, SPA rewrite to `index.html`). All secrets are `sync: false` and set in the Render dashboard; `CORS_ORIGIN` and `VITE_API_BASE_URL` are filled in after the counterpart service gets its URL.
