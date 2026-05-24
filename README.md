# Traffic Monitor PWA

Offline-first PWA for recording traffic levels from multiple providers (Google Maps, Waze, HERE, TomTom, etc.) with observer assessment, session management, GPS capture, CSV export, and optional Azure sync.

## Stack

- React + Vite
- Tailwind CSS
- Dexie (IndexedDB)
- React Router
- Papa Parse (CSV support)
- vite-plugin-pwa (Workbox)

## Run locally

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## Implemented so far

- Session start/stop and local storage
- Manual record and auto-record countdown
- Provider-level traffic buttons + observer assessment
- Geolocation capture (request + watch) with graceful fallback to `null`
- Sessions list + session detail table
- CSV export (session and all data) with 37-column legacy format and unquoted empty column 20
- Azure sync UI actions (session / sync all unsynced) with Cosmos-backed API
- Dead-letter aware sync tracking (`pending/failed/dead-letter/synced`, attempt counters, last sync error)
- Manual dead-letter recovery controls (per session and global reset back to `pending`)
- One-click `Retry + Sync now` actions (per session and global)
- PWA manifest + service worker + install prompt button
- Azure Static Web Apps workflow file

## API endpoints

The `api/` folder contains Azure SWA/Functions-compatible endpoints:

- `POST /api/entries` (upsert sessions + entries)
- `GET /api/sessions` (list sessions)
- `GET /api/sessions/{id}/entries` (list entries by session)

When Cosmos env vars are missing, endpoints return safe fallback responses (`persisted: false`) instead of crashing.

## Environment placeholders

A `.env` file is included with Cosmos placeholders:

- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DATABASE`
- `COSMOS_SESSIONS_CONTAINER`
- `COSMOS_ENTRIES_CONTAINER`
- `COSMOS_SESSIONS_PARTITION_KEY_FIELD`
- `COSMOS_ENTRIES_PARTITION_KEY_FIELD`
- `COSMOS_RETRY_ATTEMPTS`
- `COSMOS_RETRY_BASE_MS`
- `COSMOS_RETRY_MAX_MS`
- `COSMOS_UPSERT_CONCURRENCY`

These are placeholders only and must be replaced with real values before backend integration.
