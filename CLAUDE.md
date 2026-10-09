# BA — Business Analyzer

OSM-based business analyzer. Ingests GeoJSON exports, filters real business POIs into categorized CSV, provides location intelligence scoring, competitor density calculation, interactive Leaflet map, and printable HTML/PDF reports.

## Tech Stack
- **Backend:** Hono 4 + Zod + TypeScript (strict)
- **Frontend:** Vanilla JS/HTML/CSS + Leaflet 1.9.4
- **Spatial Analysis:** Haversine distance, SpatialGrid indexing, density (500m/1000m), viability scoring (0-100)
- **Linter / Formatter:** Biome 2
- **Testing:** Vitest (48 tests)
- **CI / Infrastructure:** GitHub Actions, Docker Compose

## Commands
- `pnpm dev` — start dev server with hot reload (`tsx watch src/server.ts`)
- `pnpm build` — compile TypeScript (`tsc`)
- `pnpm test` — run unit and integration tests (`vitest run`)
- `pnpm lint` — lint with Biome (`biome check src/`)
- `pnpm lint:fix` — auto-fix linting issues (`biome check --write src/`)
- `pnpm typecheck` — TypeScript check (`tsc --noEmit`)
- `pnpm check` — lint + typecheck + test
- `pnpm validate` — check + build
- `pnpm tsx src/process.ts --input=raw.geojson` — process GeoJSON to CSV with density metrics
- `bash scripts/download-data.sh "City Name"` — download Overpass data
