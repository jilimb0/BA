# Changelog

## 0.1.0 (2026-06-30)

### Added
- OSM-based business analyzer: ingest GeoJSON, filter business POIs, output categorized CSV
- Browser UI with table view, filtering by group/category, pagination (100/page)
- Tri-state field filters (has/missing/any) for phone, hours, website, address, name, favorites
- Favorites system with localStorage persistence
- Inline editing for business records (name, phone, website, hours, address)
- GeoJSON upload modal with Overpass Turbo tutorial and sample query
- Summary statistics (total, named, has phone, has website)
- Google Maps coordinates link for each business
- Cuisine tags shown when filtering by Food group
- Server-side GeoJSON processing with whitelist filtering (130+ POI types across 12 groups)
- Categorized output: food, retail, health, finance, tourism, leisure, entertainment, education, transport, services, religious, other
- Download script for fetching data from Overpass API by city name

### Changed
- Migrated from Node.js `http` module to Hono 4 framework
- Extracted core analysis logic into shared `src/analyzer.ts` module
- Added proper TypeScript strict mode with tsconfig
- Fixed `applyFilters` double-definition bug in frontend
- Fixed `setupFilters` double-definition bug in frontend
- Migration to ESM throughout the project
- Added centralized error handling with HTTPException
- Added request validation (file size limits, content-type checks)

### Added (Infrastructure)
- package.json with TypeScript strict mode, Hono 4, Zod
- Biome linting and formatting configuration
- Vitest test suite with 27 tests covering core analysis logic
- Coverage thresholds (70/60/60/70)
- GitHub Actions CI: lint → typecheck → build → test → coverage
- Dockerfile (multi-stage) + docker-compose.yml with health checks
- Dependabot configuration for npm + GitHub Actions
- Health endpoint (GET /health) with server status
- Graceful shutdown on SIGTERM/SIGINT
- 6-level methodology documentation (docs/)
