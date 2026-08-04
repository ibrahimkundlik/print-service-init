# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this service is

`print-service` is a NestJS/TypeScript microservice that lets Epson thermal printers
(TM-i, TM-DT, TM-T88VI/-iHUB, etc.) print Prime POS bills and KOTs (Kitchen Order
Tickets) directly, over Epson's **Server Direct Print (SDP)** protocol — no tablet,
driver, or app in between. The printer itself polls this service on an interval it
configures; the service holds a per-printer job queue and, when a printer polls,
responds with rendered ePOS-Print XML (a packed monochrome raster image) if work
exists.

It supersedes a legacy Python/GAE service (`ordermark-printer-service-3`). The full
design spec — protocol background, data model rationale, every fix vs. the legacy
service, and all the rendering-pipeline gotchas — lives in `FINAL_SPEC.md` (in the
sibling `print-service-dummy` repo, which also holds the original throwaway POC this
service's rendering logic was ported from). Read that spec before making structural
changes; this file is a working map of the code as it exists, not a replacement for it.

## Commands

```bash
npm install
cp .env.example .env        # then edit MONGODB_URI / PORT / PUBLIC_BASE_URL

npm run start:dev            # watch mode
npm run start                 # single run
npm run build && npm run start:prod

npm run lint                  # eslint --fix over src/test
npm run format                 # prettier --write over src/test

npm test                       # jest, rootDir: src, matches *.spec.ts
npm run test:watch
npm run test:cov
npm run test:e2e               # uses test/jest-e2e.json
```

App listens on `PORT` (default `6000` — deliberately not `3000`, since prime-web
already runs there locally). **No global route prefix** — routes are the literal
paths FINAL_SPEC.md specifies: `/api/printers`, `/api/orders`, `/api/jobs/:jobId`,
`/api/cloud`.

MongoDB must be reachable at `MONGODB_URI`. See `README.md` for local MongoDB setup
(Homebrew `mongodb-community`, including the `--fork`-doesn't-work-on-macOS gotcha).

## Architecture

**Modular monolith**, one Nest module per domain under `src/Modules/*`, each following
Controller → Service → Mongoose Schema, with DTOs (`class-validator`, lowerCamelCase
class names) for request validation. All Mongo models are registered against a single
named connection `'mongodb'` (`MongooseModule.forFeature([...], 'mongodb')` in each
module) — this convention, like the rest of the NestJS/TS/Mongo tooling choices here,
mirrors `prime-dr3` deliberately (see FINAL_SPEC.md §0).

Domains:

- **Printers** (`src/Modules/Printers`) — printer provisioning CRUD
  (`printers.controller.ts`). Generates the 8-char `printerId` (the document's `_id`,
  not a separate field), derives `printWidthDots` from `model` via
  `Config/printer-capabilities.ts`. `status` (`pending`/`online`/`offline`) is a
  liveness signal only, **not** an authorization gate — there's no revoked state;
  deleting the printer document is how you stop it from polling (FINAL_SPEC.md §6).
  A `@Cron` sweep (`OFFLINE_THRESHOLD_MS`, a fixed constant, not spec'd) flips stale
  `online` printers to `offline`.
- **Render** (`src/Modules/Render`) — the order → bill/KOT HTML → PNG → packed mono
  raster pipeline (FINAL_SPEC.md §9.3), run once per matched printer at ingest time,
  **never** on a poll/delivery. Chain: `BillHtmlService` (CorePrint) →
  `HtmlToPngService` (Puppeteer) → `RasterPackService` (sharp) → `BillRenderService`
  orchestrates all three; `EposXmlBuilderService` builds the `<PrintRequestInfo>`
  envelope for a batch of jobs. See "Rendering pipeline gotchas" below — every one of
  these was a real bug hit against physical hardware during the POC.
- **Prints** (`src/Modules/Prints`) — order ingest/fan-out (`orders.controller.ts`,
  `POST /api/orders`) and job status (`jobs.controller.ts`, `GET /api/jobs/:jobId`).
  `PrintsService` resolves fan-out targets via `PrintersService`, renders+packs once
  per target, and queues one `prints` document per match. Also owns the SetResponse
  retry/max-retry logic and the job-expiry `@Cron` sweep.
- **Cloud** (`src/Modules/Cloud`) — the endpoint the **printer itself** polls
  (`POST /api/cloud`, one shared URL for every printer). `DeviceAuthGuard` is the
  entire v1 auth model: look up `printers` by `_id = ID` form field, `404` if missing
  — no password/Digest Auth (deliberately deferred, FINAL_SPEC.md §6).
  `CloudController`/`CloudService` branch on `ConnectionType` (`GetRequest` vs.
  `SetResponse`) and use `@Res()` directly since the two flows need distinct raw
  responses (XML body / empty 200 / bare ack).
- **Logger** (`src/Modules/Logger`) — `@Global()` module. `JsonLogger` replaces Nest's
  default logger app-wide (`app.useLogger(...)` in `main.ts`). `EventLoggerService` is
  a separate, structured Kibana-bound event logger (`job.queued`, `job.delivered`,
  `job.success`, `job.failed`, `job.retried`, `job.expired`, `printer.heartbeat`,
  `queue.depth` — FINAL_SPEC.md §12) — this is where audit/history lives, deliberately
  *not* as mutable fields on the `prints` document.

Supporting, non-module code:

- `src/Config/printer-capabilities.ts` — per-model dot width (`printWidthDots`) and
  max ePOS-Print payload size lookups (FINAL_SPEC.md §11). Only TM-T88VI and TM-m30II
  dot widths are verified against real hardware; everything else is Epson's reference
  value, flagged via `verifiedAgainstRealHardware`.
- `src/Exceptions/ClientException.ts` — the custom exception type for client-facing
  errors (`{ message, errorCode, statusCode }`), used everywhere instead of raw
  `HttpException` subclasses.

### Rendering pipeline gotchas (do not "simplify" these away)

All discovered against real Epson hardware during the POC (`bill-html.service.ts` /
`html-to-png.service.ts` have the full inline explanations):

1. `@urbanpiper-engineering/prime-core-js` (CorePrint) ships raw ESM with no CJS
   build — plain `require()` and Node's native ESM loader both fail on it. Fixed by
   bundling the package's **top-level** entry point into an in-memory CJS module via
   `esbuild.buildSync` and loading it through Node's own `Module`/`_compile` API.
   Bundling `CorePrint` and `CoreHelpers` from the same top-level entry (not separate
   subpath bundles) is required so they share one inlined `i18next` instance —
   `CoreHelpers.initializeI18n('en')` must run before any render call, or translated
   strings render blank with no error.
2. The bill HTML hardcodes `max-width: 80mm` regardless of requested width — must be
   overridden via `page.addStyleTag` or content gets capped and blank margins appear
   in the printed output.
3. The bill HTML sets `background: transparent` — without forcing
   `prefers-color-scheme: light` emulation, this falls back to Chromium's dark-mode
   default and prints as a solid black rectangle.
4. One Puppeteer `Browser` instance is reused for the life of the service
   (`HtmlToPngService`'s `browserPromise`) — launching per-request added ~1.4-1.7s,
   long enough that a real printer's HTTP client timed out and retry-looped.
5. Rendering happens **once**, synchronously, at ingest/fan-out time — never on a
   `GetRequest` poll or a `SetResponse` retry. The packed raster is stored on the
   `prints` document (`payload.packedBase64`) and re-served as-is.

### Deliberate deviations / judgment calls not pinned down by FINAL_SPEC.md

- `OFFLINE_THRESHOLD_MS` (60s, `printers.service.ts`), `JOB_TTL_MS` (15min) and
  `MAX_RETRY_COUNT` (3, both in `prints.service.ts`) are fixed constants — the spec
  doesn't give exact numbers for any of them.
- `Print.retryCount` (`print.schema.ts`) is a narrow, commented deviation from
  FINAL_SPEC.md's stated preference to keep all retry history purely in the Kibana
  event trail — the SetResponse handler needs a fast synchronous answer to "already
  retried past the max?" that querying an ELK store in the request path can't give.
- `dequeueForPrinter` (`prints.service.ts`) caps a poll's page at the printer model's
  max payload size (FINAL_SPEC.md §8) — jobs that don't fit stay `queued` for the next
  poll rather than being sent oversized.

### Config notes

- `tsconfig.json` has `strictNullChecks: false` and `noImplicitAny: false` (mirrors
  `prime-dr3`) — don't assume strict null-safety when reading or writing code here.
- `.vscode/settings.json` pins `js/ts.tsdk.path` to `node_modules/typescript` — if you
  see `tsconfig.json` compiler-option errors that don't reproduce via `npx tsc`, your
  editor is probably using its own bundled TypeScript instead of the workspace one.
- Node version is pinned to `24.18.0` via `.nvmrc` (`"engines": { "node": ">=24" }` in
  `package.json`). Verified against real Node 24: native deps (`sharp`, `esbuild`)
  reinstalled cleanly and the full render pipeline (CorePrint/esbuild bundling →
  Puppeteer → sharp raster pack) produces identical output to Node 20.
- If `dist/` ends up empty after `npm run build` reports success, delete
  `tsconfig.build.tsbuildinfo` (and `tsconfig.tsbuildinfo`) and rebuild.
  `nest-cli.json`'s `deleteOutDir: true` wipes `dist/` before every build, but
  `tsc`'s incremental mode only checks source-file hashes, not whether the previous
  output still exists — if the cache thinks nothing changed, it skips re-emitting
  into the now-empty directory. Not Node-version-specific; only bites when `dist/`
  is removed independently of a source change (a fresh clone never hits this, since
  the `.tsbuildinfo` files are gitignored).
