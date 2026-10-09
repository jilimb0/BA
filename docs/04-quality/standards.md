# Level 04 — Quality Standards

## Code Standards
- **Linter & Formatter:** Biome 2 with zero-tolerance policy (`biome check src/`).
- **Type Safety:** TypeScript strict mode (`tsc --noEmit`).
- **Runtime Validation:** Zod 4 for GeoJSON structures and HTTP query validation.

## Automated Testing
- **Test Framework:** Vitest 4.
- **Coverage:** 48 unit and integration tests covering:
  - Whitelist POI retention and rejection.
  - Multi-language name extraction and fallback.
  - Haversine distance accuracy.
  - SpatialGrid spatial index correctness.
  - Multi-tier competitor and complementary density calculation.
  - Location scoring and rating classification (A–D).
  - GeoJSON / Overpass schema validation.
  - Hono API endpoints (`/health`, `/generate`, `/api/score`, `/api/report`).
