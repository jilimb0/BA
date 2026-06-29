# BA — Business Analyzer

[![CI](https://github.com/jilimb0/BA/actions/workflows/ci.yml/badge.svg)](https://github.com/jilimb0/BA/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/create-ready-stack)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/ lint-Biome-60a5fa)](https://biomejs.dev)

OSM-based business analyzer. Ingest GeoJSON exports from OpenStreetMap, filter real business POIs into categorized CSV, explore in a browser UI with filtering, favorites, and inline editing.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a GeoJSON export from [Overpass Turbo](https://overpass-turbo.eu/).

## CLI Usage

```bash
# Process an existing GeoJSON file
pnpm tsx src/process.ts --input=raw.geojson --output=businesses.csv --summary=businesses_summary.csv

# Download data for a city (then process)
bash scripts/download-data.sh "Tbilisi"
pnpm tsx src/process.ts --input=raw.geojson
```

## Features

- **12 business categories:** food, retail, health, finance, tourism, leisure, entertainment, education, transport, services, religious, other
- **130+ POI types** whitelisted — real businesses only, no junk data
- **Tri-state filters:** filter by phone/website/hours/address/name having values or missing them
- **Favorites:** star businesses for quick access (persisted in localStorage)
- **Inline editing:** correct names, phones, websites, hours, addresses
- **Pagination:** 100 rows per page with page navigation
- **GeoJSON upload:** upload fresh data through the browser UI
- **CSV export:** all data available as downloadable CSV files

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono 4 + Zod |
| Frontend | Vanilla JS, HTML, CSS |
| Analysis | TypeScript |
| Lint/Format | Biome 2 |
| Tests | Vitest (27 tests) |
| CI | GitHub Actions |
| Docker | Docker Compose + health checks |

## Project Structure

```
src/
├── server.ts      # Hono 4 web server
├── process.ts     # CLI entry for GeoJSON→CSV processing
├── analyzer.ts    # Core analysis logic (pure functions)
tests/
├── analyzer.test.ts  # 27 tests
scripts/
├── download-data.sh  # Overpass API data downloader
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Compile TypeScript |
| `pnpm test` | Run tests |
| `pnpm lint` | Biome lint |
| `pnpm typecheck` | TypeScript check |
| `pnpm check` | lint + typecheck + test |
| `pnpm validate` | check + build |
| `bash scripts/download-data.sh "City"` | Fetch GeoJSON for a city |

## API

### `GET /health`
Returns server status and timestamp.

### `POST /generate`
Upload a GeoJSON file for processing.
- Accepts `.geojson` or `.json` files (max 50MB)
- Returns `{ ok: true }` on success
- Generates `businesses.csv` and `businesses_summary.csv`

## License

MIT
