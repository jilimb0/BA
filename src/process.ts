import { readFileSync, writeFileSync } from 'node:fs';
import type { BusinessFeature, BusinessRow } from './analyzer.js';
import {
  calculateDensity,
  calculateLocationScore,
  classifyFeature,
  SpatialGrid,
} from './analyzer.js';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);

const INPUT_GEOJSON = args.input ?? 'raw.geojson';
const OUTPUT_CSV = args.output ?? 'businesses.csv';
const OUTPUT_SUMMARY = args.summary ?? 'businesses_summary.csv';
const CITY_NAME = args.city ?? 'Businesses';

const raw = JSON.parse(readFileSync(INPUT_GEOJSON, 'utf-8'));
const features: BusinessFeature[] = raw.features ?? raw.elements ?? [];

const classifiedList: BusinessRow[] = [];
const summary: Record<string, Record<string, number>> = {};
let skipped = 0;

const grid = new SpatialGrid(0.01);

for (const f of features) {
  const result = classifyFeature(f);
  if (!result) {
    skipped++;
    continue;
  }

  classifiedList.push(result);

  const latNum = Number.parseFloat(result.lat);
  const lonNum = Number.parseFloat(result.lon);
  if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
    grid.insert({
      lat: latNum,
      lon: lonNum,
      category: result.category,
      group: result.group,
    });
  }

  summary[result.group] ??= {};
  const catVal = result.category ? result.category.replace(/^"|"$/g, '') : '';
  summary[result.group][catVal] = (summary[result.group][catVal] ?? 0) + 1;
}

const rows: string[] = [];

for (const result of classifiedList) {
  const latNum = Number.parseFloat(result.lat);
  const lonNum = Number.parseFloat(result.lon);
  let density500 = 0;
  let density1000 = 0;
  let locationScore = 0;

  if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
    const nearby = grid.getNearby(latNum, lonNum, 1000);
    const d = calculateDensity(
      { lat: latNum, lon: lonNum, category: result.category, group: result.group },
      nearby,
    );
    density500 = d.totalNearby500;
    density1000 = d.totalNearby1000;
    const scoreObj = calculateLocationScore(
      { lat: latNum, lon: lonNum, category: result.category, group: result.group },
      nearby,
    );
    locationScore = scoreObj.score;
  }

  rows.push(
    [
      result.osmId,
      result.name,
      result.tagKey,
      result.category,
      result.group,
      result.lat,
      result.lon,
      result.street,
      result.housenumber,
      result.phone,
      result.website,
      result.openingHours,
      result.cuisine,
      result.brand,
      density500,
      density1000,
      locationScore,
    ].join(','),
  );
}

const header =
  'osm_id,name,tag_key,category,group,lat,lon,street,housenumber,phone,website,opening_hours,cuisine,brand,density_500m,density_1000m,location_score';
writeFileSync(OUTPUT_CSV, [header, ...rows].join('\n'), 'utf-8');

const summaryRows = ['group,category,count'];
for (const [g, cats] of Object.entries(summary).sort()) {
  for (const [c, cnt] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    summaryRows.push(`${g},${c},${cnt}`);
  }
}
writeFileSync(OUTPUT_SUMMARY, summaryRows.join('\n'), 'utf-8');

console.log(`\n✅ ${CITY_NAME}: ${rows.length}`);
console.log(`🗑️  Skipped: ${skipped}`);
console.log(`📄 → ${OUTPUT_CSV}`);
console.log(`📊 → ${OUTPUT_SUMMARY}\n`);

console.table(
  Object.entries(summary)
    .map(([g, cats]) => ({
      group: g,
      total: Object.values(cats).reduce((a, b) => a + b, 0),
      top: Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, n]) => `${c}:${n}`)
        .join(', '),
    }))
    .sort((a, b) => b.total - a.total),
);
