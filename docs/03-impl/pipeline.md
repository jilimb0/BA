# Level 03 — Implementation Pipeline

## Overview
BA implements a high-throughput location intelligence and POI analysis pipeline:

1. **Ingestion (`src/server.ts` & `src/process.ts`)**:
   - Ingests GeoJSON or Overpass JSON payloads up to 50MB.
   - Validates feature structure and geometries using Zod 4 schemas (`GeoJSONFeatureCollectionSchema`).

2. **Categorization (`src/analyzer.ts`)**:
   - Filters features against whitelists (`AMENITY_KEEP`, `SHOP_KEEP`, etc.).
   - Maps 130+ POI types to 12 top-level business groups (`GROUP_MAP`).

3. **Spatial Analysis & Density**:
   - `SpatialGrid`: $O(N)$ 2D spatial hash grid (0.01° cell size) capable of handling 15,000+ points in seconds.
   - `calculateDensity`: Computes total businesses, direct competitors, and complementary footfall drivers in 500m (pedestrian zone) and 1000m (catchment zone).
   - `calculateLocationScore`: Composite scoring model (0–100) assigning viability grades A–D based on footfall attractors, proven demand vs oversaturation, and district maturity.

4. **Persistence & Presentation (`public/`)**:
   - Outputs enriched CSV with `density_500m`, `density_1000m`, `location_score`.
   - Browser UI with interactive Leaflet map, catchment radius circles, sortable data table, tri-state field filters, and printable HTML location intelligence reports.
