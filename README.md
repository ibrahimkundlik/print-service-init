# print-service

Cloud printing service for Prime Bills & KOTs. Lets Epson thermal
printers poll this service directly over HTTPS and print Bills & KOTs — no tablet,
driver, or app in between.

Full design/rationale lives in `FINAL_SPEC.md` (in the sibling `print-service-dummy`
repo). This README only covers running the service locally.

## Stack

- TypeScript + NestJS
- MongoDB (via Mongoose)
- Puppeteer + `@urbanpiper-engineering/prime-core-js` (CorePrint) for order → bill/KOT
  HTML → PNG rendering, `sharp` for packing into Epson's mono raster `<image>` format

## Prerequisites

- Node.js 24.18.0 (pinned in `.nvmrc` — run `nvm use` if you use nvm)
- MongoDB running locally (or reachable via `MONGODB_URI`)

### Installing MongoDB locally (macOS)

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

If `brew services start` fails with a launchctl bootstrap error, run `mongod`
directly instead:

```bash
mkdir -p .mongo-data
mongod --dbpath ./.mongo-data --port 27017 --logpath ./.mongo-data/mongod.log &
```

## Setup

```bash
npm install
cp .env.example .env
```

`.env` fields:

| Variable          | Purpose                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`     | Mongo connection string                                                                                                                 |
| `PORT`            | HTTP port (default `6000` — not `3000`, since prime-web already runs there)                                                             |
| `PUBLIC_BASE_URL` | Base URL printers/ops UI use to reach this service; the SDP `Server1 URL` returned on printer creation is `<PUBLIC_BASE_URL>/api/cloud` |

## Running

```bash
npm run start:dev   # watch mode
npm run start        # single run
npm run build && npm run start:prod   # compiled build
```

The service listens on `PORT` (default `6000`) with no global route prefix — routes
are exactly `/api/printers`, `/api/orders`, `/api/jobs/:printerId`, `/api/cloud`.

`/api/printers/*` and `/api/jobs/*` require a valid Prime bearer token
(`Authorization: Bearer <token>` — validated against `<PRIME_API_URL>/users/authorities/v2`).
`/api/orders` and `/api/cloud` don't — the former is an internal ingest endpoint, the
latter is what the printer itself calls (auth is the `ID` form field, looked up
directly against the `printers` collection).

## Quick smoke test

```bash
TOKEN="<a real Prime bearer token>"

# 1. Register a printer
curl -s -X POST http://localhost:6000/api/printers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bizId":22334455,"locationIds":[233632],"label":"Front Counter","printType":["bill"],"model":"TM-T88VI"}'
# -> { "printer": { "_id": "<printerId>", "status": "pending", ... }, "webConfig": { "id": "<printerId>", "url": "..." } }

# 2. Simulate the printer's first poll (flips status pending -> online)
curl -s -X POST http://localhost:6000/api/cloud \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ID=<printerId>&ConnectionType=GetRequest"

# 3. Ingest an order (fans out to every matching printer, renders + queues a job).
#    Response is 200 with an empty body either way; check step 5 to see what landed.
curl -s -X POST http://localhost:6000/api/orders \
  -H "Content-Type: application/json" \
  -d @order.json

# 4. Poll again to fetch the rendered ePOS-Print XML for that job
curl -s -X POST http://localhost:6000/api/cloud \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "ID=<printerId>&ConnectionType=GetRequest"

# 5. List that printer's jobs from the last 24h
curl -s http://localhost:6000/api/jobs/<printerId> -H "Authorization: Bearer $TOKEN"
```

`order.json` needs at minimum `upr_id`, `codex_biz_id`, and `location.id` matching a
registered printer's `bizId`/`locationIds`, plus a real `data.lines` array (CorePrint
renders actual line items — an order payload with no lines will fail rendering).

## Module layout

```
src/
  Modules/
    Printers/    # printer provisioning CRUD, offline-staleness sweep
    Render/      # order -> bill/KOT HTML -> PNG -> packed raster pipeline
    PrintJobs/   # order ingest/fan-out, per-printer job listing, expiry sweep
    Cloud/       # the SDP endpoint itself (GetRequest/SetResponse), device auth guard
    Auth/        # Prime bearer-token guard (validates against Prime's authorities endpoint)
    Logger/      # JSON logger + structured Kibana-bound event logger
  Config/        # printer capability tables (dot width, max payload size by model)
  Exceptions/    # ClientException (domain errors -> HTTP status)
```
