export const CAT_KEYS = ['amenity', 'shop', 'healthcare', 'office', 'leisure', 'tourism', 'craft'];

export const AMENITY_KEEP = new Set([
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'fast_food',
  'food_court',
  'ice_cream',
  'biergarten',
  'pharmacy',
  'clinic',
  'hospital',
  'dentist',
  'doctors',
  'veterinary',
  'bureau_de_change',
  'fuel',
  'car_wash',
  'car_rental',
  'taxi',
  'school',
  'university',
  'college',
  'kindergarten',
  'library',
  'language_school',
  'cinema',
  'theatre',
  'nightclub',
  'arts_centre',
  'post_office',
  'coworking_space',
]);

export const SHOP_KEEP = new Set([
  'supermarket',
  'convenience',
  'grocery',
  'bakery',
  'butcher',
  'greengrocer',
  'clothes',
  'shoes',
  'electronics',
  'hardware',
  'furniture',
  'florist',
  'jewelry',
  'gift',
  'books',
  'mall',
  'department_store',
  'marketplace',
  'hairdresser',
  'beauty',
  'laundry',
  'tailor',
  'dry_cleaning',
  'travel_agency',
  'optician',
  'wine',
  'alcohol',
  'coffee',
  'confectionery',
  'pastry',
  'dairy',
  'deli',
  'seafood',
  'outdoor',
  'sports',
  'toys',
  'pet',
  'bicycle',
  'cosmetics',
  'massage',
  'music',
  'art',
  'car',
  'car_parts',
  'car_repair',
  'motorcycle',
  'computer',
  'mobile_phone',
  'appliance',
  'paint',
  'garden_centre',
  'do_it_yourself',
  'ticket',
  'stationery',
  'bags',
  'watches',
  'glasses',
  'herbalist',
  'nutrition_supplements',
]);

export const HEALTHCARE_KEEP = new Set([
  'clinic',
  'hospital',
  'dentist',
  'pharmacy',
  'physiotherapist',
  'psychotherapist',
  'blood_donation',
  'sample_collection',
]);

export const OFFICE_KEEP = new Set([
  'lawyer',
  'accountant',
  'insurance',
  'real_estate',
  'travel_agent',
  'courier',
  'advertising_agency',
  'ngo',
  'company',
  'architect',
  'coworking',
  'financial',
  'consulting',
  'telecommunications',
  'educational_institution',
]);

export const LEISURE_KEEP = new Set([
  'sports_centre',
  'fitness_centre',
  'swimming_pool',
  'gym',
  'dance',
]);

export const TOURISM_KEEP = new Set([
  'hotel',
  'hostel',
  'guest_house',
  'motel',
  'attraction',
  'museum',
  'gallery',
]);

export const CRAFT_KEEP = new Set([
  'carpenter',
  'electrician',
  'plumber',
  'shoemaker',
  'tailor',
  'photographer',
  'electronics_repair',
  'key_cutter',
  'watchmaker',
  'jeweller',
  'confectionery',
  'handicraft',
  'pottery',
]);

import groupMap from './config/groups.json' with { type: 'json' };

export const GROUP_MAP: Record<string, string> = groupMap;

export function isKeep(key: string, val: string): boolean {
  if (key === 'amenity') return AMENITY_KEEP.has(val);
  if (key === 'shop') return SHOP_KEEP.has(val);
  if (key === 'healthcare') return HEALTHCARE_KEEP.has(val);
  if (key === 'office') return OFFICE_KEEP.has(val);
  if (key === 'leisure') return LEISURE_KEEP.has(val);
  if (key === 'tourism') return TOURISM_KEEP.has(val);
  if (key === 'craft') return CRAFT_KEEP.has(val);
  return false;
}

export function getCategoryKey(props: Record<string, string>): string {
  for (const k of CAT_KEYS) {
    if (props[k]) return k;
  }
  return '';
}

export function getCategoryValue(props: Record<string, string>): string {
  for (const k of CAT_KEYS) {
    if (props[k]) return props[k];
  }
  return '';
}

export function esc(v: unknown): string {
  if (v == null || v === '') return '';
  const s = String(v).replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

export interface BusinessFeature {
  properties?: Record<string, string>;
  tags?: Record<string, string>;
  geometry?: { type: string; coordinates: number[] };
  id?: string;
}

export interface BusinessRow {
  osmId: string;
  name: string;
  tagKey: string;
  category: string;
  group: string;
  lat: string;
  lon: string;
  street: string;
  housenumber: string;
  phone: string;
  website: string;
  openingHours: string;
  cuisine: string;
  brand: string;
}

export function classifyFeature(f: BusinessFeature): BusinessRow | null {
  const props = f.properties ?? f.tags ?? {};
  const catKey = getCategoryKey(props as Record<string, string>);
  const catVal = getCategoryValue(props as Record<string, string>);

  if (!catKey) return null;
  if (!isKeep(catKey, catVal)) return null;

  const geo = f.geometry;
  let lat = '';
  let lon = '';
  if (geo?.type === 'Point') {
    lon = geo.coordinates[0]?.toFixed(6) ?? '';
    lat = geo.coordinates[1]?.toFixed(6) ?? '';
  } else if (props['@lat']) {
    lat = props['@lat'];
    lon = props['@lon'];
  }

  const group = GROUP_MAP[catVal] ?? 'other';
  const name = props.name || props['name:en'] || props['name:ka'] || props['name:ru'] || '';

  return {
    osmId: esc(props['@id'] ?? f.id ?? ''),
    name: esc(name),
    tagKey: esc(catKey),
    category: esc(catVal),
    group: esc(group),
    lat,
    lon,
    street: esc(props['addr:street'] ?? ''),
    housenumber: esc(props['addr:housenumber'] ?? ''),
    phone: esc(props.phone ?? props['contact:phone'] ?? ''),
    website: esc(props.website ?? props['contact:website'] ?? ''),
    openingHours: esc(props.opening_hours ?? ''),
    cuisine: esc(props.cuisine ?? ''),
    brand: esc(props.brand ?? ''),
  };
}

// --- Spatial Analytics & Density Calculation ---

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface DensityMetrics {
  totalNearby500: number;
  totalNearby1000: number;
  competitorsNearby500: number;
  competitorsNearby1000: number;
  complementaryNearby500: number;
  complementaryNearby1000: number;
}

export interface TargetPOI {
  lat: number;
  lon: number;
  category?: string;
  group?: string;
}

export interface ReferencePOI {
  lat: number;
  lon: number;
  category?: string;
  group?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
}

const COMPLEMENTARY_GROUPS = new Set([
  'retail',
  'office',
  'tourism',
  'education',
  'transport',
  'leisure',
]);

export function calculateDensity(target: TargetPOI, pois: ReferencePOI[]): DensityMetrics {
  let totalNearby500 = 0;
  let totalNearby1000 = 0;
  let competitorsNearby500 = 0;
  let competitorsNearby1000 = 0;
  let complementaryNearby500 = 0;
  let complementaryNearby1000 = 0;

  const targetCat = (target.category ?? '').toLowerCase().replace(/"/g, '');
  const targetGroup = (target.group ?? '').toLowerCase().replace(/"/g, '');

  for (const p of pois) {
    if (p.lat === target.lat && p.lon === target.lon) continue;
    const dist = haversineDistance(target.lat, target.lon, p.lat, p.lon);
    if (dist <= 1000) {
      totalNearby1000++;
      const pCat = (p.category ?? '').toLowerCase().replace(/"/g, '');
      const pGroup = (p.group ?? '').toLowerCase().replace(/"/g, '');

      const isCompetitor = targetCat && pCat ? targetCat === pCat : targetGroup === pGroup;
      if (isCompetitor) {
        competitorsNearby1000++;
      } else if (COMPLEMENTARY_GROUPS.has(pGroup)) {
        complementaryNearby1000++;
      }

      if (dist <= 500) {
        totalNearby500++;
        if (isCompetitor) competitorsNearby500++;
        else if (COMPLEMENTARY_GROUPS.has(pGroup)) complementaryNearby500++;
      }
    }
  }

  return {
    totalNearby500,
    totalNearby1000,
    competitorsNearby500,
    competitorsNearby1000,
    complementaryNearby500,
    complementaryNearby1000,
  };
}

export class SpatialGrid {
  private cellSize: number;
  private cells: Map<string, ReferencePOI[]> = new Map();

  constructor(cellSize = 0.01) {
    this.cellSize = cellSize;
  }

  private getKey(lat: number, lon: number): string {
    const y = Math.floor(lat / this.cellSize);
    const x = Math.floor(lon / this.cellSize);
    return `${y}:${x}`;
  }

  public insert(poi: ReferencePOI): void {
    if (poi.lat == null || poi.lon == null || Number.isNaN(poi.lat) || Number.isNaN(poi.lon))
      return;
    const key = this.getKey(poi.lat, poi.lon);
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    list.push(poi);
  }

  public getNearby(lat: number, lon: number, radiusMeters = 1000): ReferencePOI[] {
    const cy = Math.floor(lat / this.cellSize);
    const cx = Math.floor(lon / this.cellSize);
    const result: ReferencePOI[] = [];
    const cellSpan = Math.max(1, Math.ceil(radiusMeters / 111000 / this.cellSize));

    for (let dy = -cellSpan; dy <= cellSpan; dy++) {
      for (let dx = -cellSpan; dx <= cellSpan; dx++) {
        const key = `${cy + dy}:${cx + dx}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (const poi of cell) {
            if (haversineDistance(lat, lon, poi.lat, poi.lon) <= radiusMeters) {
              result.push(poi);
            }
          }
        }
      }
    }
    return result;
  }
}

export interface LocationScoreResult {
  score: number;
  rating: 'A' | 'B' | 'C' | 'D';
  metrics: {
    footfallAttractors: number;
    directCompetition: number;
    commercialMaturity: number;
    marketSaturation: 'low' | 'moderate' | 'high' | 'oversaturated';
  };
  recommendation: string;
}

export function calculateLocationScore(
  target: TargetPOI,
  pois: ReferencePOI[],
): LocationScoreResult {
  const density = calculateDensity(target, pois);

  // 1. Footfall attractors (0-40 pts): complementary businesses within 500m
  const footfallPoints = Math.min(40, Math.round(density.complementaryNearby500 * 2));

  // 2. Direct competition balance (0-25 pts)
  // Moderate competition (3-8) shows proven demand; 0-2 has uncertain demand; >15 is oversaturated
  let compPoints = 20;
  let saturation: 'low' | 'moderate' | 'high' | 'oversaturated' = 'moderate';
  if (density.competitorsNearby500 === 0) {
    compPoints = 12; // Unproven location
    saturation = 'low';
  } else if (density.competitorsNearby500 <= 5) {
    compPoints = 25; // Sweet spot
    saturation = 'moderate';
  } else if (density.competitorsNearby500 <= 12) {
    compPoints = 18; // High competition
    saturation = 'high';
  } else {
    compPoints = 8; // Oversaturated
    saturation = 'oversaturated';
  }

  // 3. Commercial Maturity (0-20 pts): overall vibrancy within 1000m
  const maturityPoints = Math.min(20, Math.round(density.totalNearby1000 / 5));

  // 4. Pedestrian hub density within 500m (0-15 pts)
  const pedestrianHubPoints = Math.min(15, Math.round(density.totalNearby500 / 3));

  const totalScore = Math.min(
    100,
    Math.max(0, footfallPoints + compPoints + maturityPoints + pedestrianHubPoints),
  );

  let rating: 'A' | 'B' | 'C' | 'D' = 'C';
  let recommendation = '';
  if (totalScore >= 80) {
    rating = 'A';
    recommendation =
      'Prime commercial location: strong pedestrian footfall and healthy cluster dynamics.';
  } else if (totalScore >= 60) {
    rating = 'B';
    recommendation =
      'Good commercial viability: solid footfall potential, monitor direct competitor differentiation.';
  } else if (totalScore >= 40) {
    rating = 'C';
    recommendation =
      'Moderate potential: requires niche marketing or destination pull to drive traffic.';
  } else {
    rating = 'D';
    recommendation = 'Low density or oversaturated zone: high risk for walk-in dependent retail.';
  }

  return {
    score: totalScore,
    rating,
    metrics: {
      footfallAttractors: density.complementaryNearby500,
      directCompetition: density.competitorsNearby500,
      commercialMaturity: density.totalNearby1000,
      marketSaturation: saturation,
    },
    recommendation,
  };
}

// --- Zod 4 Schemas for GeoJSON Validation ---

import { z } from 'zod';

export const GeoJSONGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.union([
    z.array(z.number()),
    z.array(z.array(z.number())),
    z.array(z.array(z.array(z.number()))),
  ]),
});

export const GeoJSONFeatureSchema = z.object({
  type: z.literal('Feature').optional(),
  id: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  geometry: GeoJSONGeometrySchema.optional(),
});

export const GeoJSONFeatureCollectionSchema = z.object({
  type: z.string().optional(),
  features: z.array(GeoJSONFeatureSchema).optional(),
  elements: z.array(GeoJSONFeatureSchema).optional(),
});

export function validateGeoJSON(data: unknown) {
  return GeoJSONFeatureCollectionSchema.safeParse(data);
}

// --- Interactive HTML/PDF Report Generator ---

export function generateLocationReportHtml(
  business: BusinessRow,
  density: DensityMetrics,
  score: LocationScoreResult,
): string {
  const cleanName = (business.name || 'Unnamed Business').replace(/"/g, '');
  const cleanCat = (business.category || 'N/A').replace(/"/g, '');
  const cleanGroup = (business.group || 'other').replace(/"/g, '');
  const cleanPhone = (business.phone || '—').replace(/"/g, '');
  const cleanWebsite = (business.website || '—').replace(/"/g, '');
  const cleanHours = (business.openingHours || '—').replace(/"/g, '');
  const cleanAddress = `${business.street || ''} ${business.housenumber || ''}`.trim() || '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Location Intelligence Report — ${cleanName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 32px; }
    .report-card { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 32px; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; font-size: 24px; color: #0f172a; }
    .badge-rating { font-size: 28px; font-weight: 800; padding: 6px 16px; border-radius: 8px; background: #4f46e5; color: white; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-box { background: #f1f5f9; padding: 16px; border-radius: 8px; }
    .stat-box .val { font-size: 22px; font-weight: 700; color: #4338ca; }
    .stat-box .lbl { font-size: 13px; color: #64748b; margin-top: 4px; }
    .details { margin-bottom: 24px; }
    .details table { width: 100%; border-collapse: collapse; }
    .details td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .details td:first-child { color: #64748b; width: 160px; font-weight: 500; }
    .rec-box { background: #eef2ff; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 4px; margin-top: 16px; }
    .print-btn { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
    @media print { .print-btn { display: none; } body { padding: 0; } .report-card { box-shadow: none; border: none; } }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      <div>
        <h1>📍 ${cleanName}</h1>
        <p style="margin:4px 0 0; color:#64748b; font-size:14px;">Group: <strong>${cleanGroup}</strong> · Category: <strong>${cleanCat}</strong></p>
      </div>
      <div style="text-align:right;">
        <span class="badge-rating">Grade ${score.rating}</span>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">Score: ${score.score} / 100</div>
      </div>
    </div>

    <div class="grid">
      <div class="stat-box">
        <div class="val">${density.totalNearby500}</div>
        <div class="lbl">Businesses in 500m radius</div>
      </div>
      <div class="stat-box">
        <div class="val">${density.totalNearby1000}</div>
        <div class="lbl">Businesses in 1000m catchment</div>
      </div>
      <div class="stat-box">
        <div class="val">${density.competitorsNearby500}</div>
        <div class="lbl">Direct competitors (500m)</div>
      </div>
      <div class="stat-box">
        <div class="val">${density.complementaryNearby500}</div>
        <div class="lbl">Footfall drivers (Retail/Office/Transit)</div>
      </div>
    </div>

    <div class="details">
      <h3>Location & Contact Metadata</h3>
      <table>
        <tr><td>Coordinates</td><td>${business.lat}, ${business.lon}</td></tr>
        <tr><td>Address</td><td>${cleanAddress}</td></tr>
        <tr><td>Phone</td><td>${cleanPhone}</td></tr>
        <tr><td>Website</td><td>${cleanWebsite}</td></tr>
        <tr><td>Hours</td><td>${cleanHours}</td></tr>
        <tr><td>Market Saturation</td><td>${score.metrics.marketSaturation.toUpperCase()}</td></tr>
      </table>
    </div>

    <div class="rec-box">
      <strong>Strategic Recommendation:</strong>
      <p style="margin:6px 0 0; font-size:14px;">${score.recommendation}</p>
    </div>

    <div style="margin-top:24px; text-align:right;">
      <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    </div>
  </div>
</body>
</html>`;
}
