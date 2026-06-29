# BA — Business Analyzer

OSM-based business analyzer. Ingests GeoJSON exports, filters real business POIs into categorized CSV, browser UI with filtering/favorites/editing.

## Tech Stack
- **Backend:** Hono 4 + Zod + TypeScript (strict)
- **Frontend:** Vanilla JS/HTML/CSS (single-page table view)
- **Analysis:** TypeScript, whitelist filtering, GROUP_MAP categorization
- **Infrastructure:** Docker Compose, GitHub Actions CI, Dependabot

## Commands
- `pnpm dev` — start dev server (tsx watch)
- `pnpm start` — `node dist/server.js`
- `pnpm build` — `tsc`
- `pnpm test` — `vitest run`
- `pnpm test:coverage` — with coverage report
- `pnpm lint` — `biome check src/`
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm check` — lint + typecheck + test
- `pnpm validate` — check + build
- `bash scripts/download-data.sh "City Name"` — fetch Overpass data

## Architecture
- `src/server.ts` — Hono 4 server (static files + /generate + /health)
- `src/process.ts` — CLI entry for GeoJSON→CSV processing
- `src/analyzer.ts` — pure functions: isKeep, classifyFeature, esc, GROUP_MAP

## Testing
- 27 tests in `tests/analyzer.test.ts`
- Coverage thresholds: 70/60/60/70
