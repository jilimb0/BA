# Brief - Business Analyzer

## Problem
Extracting and analyzing business POI data from OpenStreetMap exports is manual and time-consuming.

## Target Audience
Market researchers, business analysts, urban planners.

## Main Scenario
Upload a GeoJSON export from Overpass Turbo → filter real businesses → browse, filter, and export categorized CSV.

## Success Criteria for v1
- Ingest any GeoJSON with business POIs
- Filter out non-business features (benches, waste baskets, etc.)
- Categorize businesses into 12 groups
- Browser UI with filtering, favorites, and CSV export

## Stack
Node.js + Hono 4 (backend), Vanilla JS/HTML/CSS (frontend), TypeScript (analysis)
