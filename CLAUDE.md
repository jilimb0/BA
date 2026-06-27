# BA — Business Analyzer

OSM-based business analyzer. Ingests GeoJSON exports, filters real business POIs into categorized CSV, browser UI with filtering/favorites/editing.

## Tech Stack
- **Frontend:** Vanilla JS/HTML/CSS (single-page table view)
- **Backend:** Node.js built-in `http` module
- **Data:** GeoJSON, CSV, TypeScript (`process.ts`)
- **Runtime:** Node.js, `npx tsx` for TypeScript

## Commands
- `node server.js` — start server on port 3000
- `npx tsx process.ts` — process GeoJSON to CSV
- No package.json (vanilla project)
