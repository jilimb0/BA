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
