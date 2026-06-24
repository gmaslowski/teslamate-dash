# CLAUDE.md

teslamate-dash: read-only, self-hosted dashboard for TeslaMate. Single Go binary, embedded web UI, one container.

## Layout

- `main.go` server + graceful shutdown, embeds `web/`.
- `config.go` env config (reuses TeslaMate `DATABASE_*`, `TC_` overrides).
- `model.go` types + the `Store` interface.
- `db.go` read-only pgx pool and all SQL. The only file that talks to Postgres.
- `demo.go` synthetic data so the binary runs with no DB.
- `handlers.go` JSON API.
- `web/` embedded static frontend (MapLibre + vanilla JS).

## Hard rules

- **Read-only, always.** Never add INSERT/UPDATE/DELETE/DDL. Sessions are forced read-only in `openDB`;
  keep it that way and assume a read-only DB role.
- **No telemetry, no outbound server calls.** The server must not phone home. The only external request
  is the browser fetching basemap tiles from the configured style URL.
- **Privacy first.** This is someone's home and movements. Do not log coordinates. Keep `TC_REDACT_HOME`
  meaningful. Never commit real data; demo data only.
- **Stay a companion.** Do not modify TeslaMate's schema or write to its tables. Ride alongside.

## Conventions

- Add a new read path: extend the `Store` interface, implement in both `db.go` and `demo.go`, expose in
  `handlers.go`. Keep queries parameterised and bounded (LIMIT, date range).
- Frontend stays dependency-light: MapLibre from CDN, no build step.
- Brand accent is teal (`#0E9AA7`). Headings Poppins, body Inter. Avoid em dashes in UI copy.

## Build / run

```bash
go mod tidy
go run .                 # demo mode if no DATABASE_HOST
docker build -t teslamate-dash . && docker run --rm -p 4001:4001 teslamate-dash
```

## Publish (do this yourself; Claude will not push or take tokens)

```bash
gh repo create teslamate-dash --private --source . --push
```
