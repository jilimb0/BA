# Contributing

## Setup

```bash
git clone <repo-url>
cd BA
pnpm install
```

## Development

```bash
pnpm dev          # Start dev server with hot reload
pnpm test         # Run tests
pnpm test:watch   # Tests in watch mode
pnpm lint         # Biome lint
pnpm typecheck    # TypeScript type check
pnpm check        # lint + typecheck + test
pnpm validate     # check + build
pnpm download-data "City Name"  # Fetch GeoJSON for a city
```

## Project Structure

```
BA/
├── src/
│   ├── server.ts      # Hono 4 web server
│   ├── process.ts     # CLI entry for GeoJSON→CSV processing
│   └── analyzer.ts    # Core analysis logic (pure functions)
├── tests/
│   └── analyzer.test.ts  # 27 tests for core logic
├── scripts/
│   └── download-data.sh  # Overpass API data downloader
├── public/            # Static assets
├── index.html         # Browser UI
├── styles.css         # Styling
└── script.js          # Frontend logic
```

## Adding a New POI Category

1. Add the OSM tag value to the appropriate whitelist set in `src/analyzer.ts`
2. Add the mapping to `GROUP_MAP` in `src/analyzer.ts`
3. Add a test case in `tests/analyzer.test.ts`
4. Run `pnpm test` to verify

## Testing

- Core logic tests in `tests/analyzer.test.ts` (27 tests)
- Run `pnpm test:coverage` to check coverage
- Thresholds: 70% statements, 60% branches, 60% functions, 70% lines
