import { readFileSync, writeFileSync } from 'node:fs';
import type { BusinessFeature } from './analyzer.js';
import { classifyFeature } from './analyzer.js';

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

const rows: string[] = [];
const summary: Record<string, Record<string, number>> = {};
let skipped = 0;

for (const f of features) {
  const result = classifyFeature(f);
  if (!result) {
    skipped++;
    continue;
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
    ].join(','),
  );

  summary[result.group] ??= {};
  const catVal = result.category ? result.category.replace(/^"|"$/g, '') : '';
  summary[result.group][catVal] = (summary[result.group][catVal] ?? 0) + 1;
}

const header =
  'osm_id,name,tag_key,category,group,lat,lon,street,housenumber,phone,website,opening_hours,cuisine,brand';
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
