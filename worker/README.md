# Speedhawk Worker

The worker is a background Node.js process that picks up audit jobs from a Redis queue, runs Lighthouse against the target URL, saves metrics and AI-generated suggestions to Postgres, and marks the audit complete.

## End-to-end flow

```
API server
  └─ enqueues job { auditId, url } onto BullMQ "audits" queue (Redis)

Worker (worker.js)
  └─ BullMQ Worker dequeues job
       └─ processAudit (auditProcessor.js)
            1. Deletes any partial data from a previous attempt
            2. Sets audit status → "running"
            3. Launches Chromium via Puppeteer
            4. Navigates to the URL (for DOM metadata collection)
            5. Runs Lighthouse on the same browser port
            6. Extracts page context via extractPageContext()
            7. Closes the browser
            8. Saves metrics → metrics table
            9. Calls Gemini with metrics + page context → saves suggestions
               └─ Falls back to rule-based suggestions if Gemini fails
           10. Sets audit status → "complete"
```

## Source layout

| File | Description |
|---|---|
| `src/worker.js` | BullMQ entrypoint; registers `processAudit` as the job handler |
| `src/config/database.js` | pg connection pool with TLS |
| `src/config/queue.js` | BullMQ Redis connection config |
| `src/processors/auditProcessor.js` | Core job handler — Puppeteer, Lighthouse, Gemini, DB writes |
| `src/utils/extractPageContext.js` | Builds compact context from Lighthouse result + Puppeteer page |
| `src/utils/validateSuggestions.js` | Validates Gemini JSON output; rule-based fallback suggestions |

## Key dependencies

| Package | Purpose |
|---|---|
| `bullmq` | Redis-backed job queue — dequeues audit jobs from the API |
| `puppeteer` | Headless Chromium — provides the browser port Lighthouse attaches to, and enables DOM inspection |
| `lighthouse` | Runs a performance audit and returns the full `lhr` result object |
| `@google/genai` | Gemini API client — generates specific, actionable suggestions from metrics + page context |
| `pg` | Postgres client — persists metrics and suggestions |

## Page context extraction

`extractPageContext(lhr, page)` runs after Lighthouse completes and builds a bounded JSON object passed into the Gemini prompt. It pulls:

- **Failed audits** — Lighthouse audit IDs that scored below 0.9, with titles and display values
- **Largest network resources** — top JS, CSS, font, and image transfers by size
- **Render-blocking resources** — scripts and stylesheets delaying first paint
- **Unoptimized images** — candidates from image audits, sorted by estimated wasted KB
- **DOM metadata** — script/stylesheet/image counts and above-fold image URLs (from Puppeteer)

Nothing sensitive (HTML source, JS bundles, cookies, headers) is included.

## Suggestion fallback

If Gemini fails or returns invalid JSON, `getFallbackSuggestions()` in `validateSuggestions.js` generates rule-based suggestions from the raw metric values (LCP, TTFB, FCP, bundle size). The audit always completes with at least one suggestion.

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_HOST` | Redis hostname |
| `REDIS_PORT` | Redis port (default 6379) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis password / Upstash token |
| `GEMINI_API_KEY` | Google Gemini API key |

## Docker

The `Dockerfile` installs Chromium via apt and sets `PUPPETEER_SKIP_DOWNLOAD=true` so Puppeteer does not download a second copy.

```bash
docker build -t speedhawk-worker .
docker run --env-file .env speedhawk-worker
```
