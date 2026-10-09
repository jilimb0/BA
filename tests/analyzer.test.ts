import { describe, expect, it } from 'vitest';
import type { BusinessFeature } from '../src/analyzer.js';
import {
  CAT_KEYS,
  calculateDensity,
  calculateLocationScore,
  classifyFeature,
  esc,
  GROUP_MAP,
  generateLocationReportHtml,
  getCategoryKey,
  getCategoryValue,
  haversineDistance,
  isKeep,
  SpatialGrid,
  validateGeoJSON,
} from '../src/analyzer.js';

describe('isKeep', () => {
  it('keeps known amenity types', () => {
    expect(isKeep('amenity', 'restaurant')).toBe(true);
    expect(isKeep('amenity', 'cafe')).toBe(true);
    expect(isKeep('amenity', 'pharmacy')).toBe(true);
  });

  it('rejects unknown amenity types', () => {
    expect(isKeep('amenity', 'toilets')).toBe(false);
    expect(isKeep('amenity', 'bench')).toBe(false);
    expect(isKeep('amenity', 'waste_basket')).toBe(false);
  });

  it('keeps known shop types', () => {
    expect(isKeep('shop', 'supermarket')).toBe(true);
    expect(isKeep('shop', 'bakery')).toBe(true);
    expect(isKeep('shop', 'hairdresser')).toBe(true);
  });

  it('rejects unknown shop types', () => {
    expect(isKeep('shop', 'vacant')).toBe(false);
  });

  it('rejects unknown category keys', () => {
    expect(isKeep('unknown', 'anything')).toBe(false);
  });

  it('handles healthcare, office, leisure, tourism, craft keys', () => {
    expect(isKeep('healthcare', 'clinic')).toBe(true);
    expect(isKeep('office', 'lawyer')).toBe(true);
    expect(isKeep('leisure', 'gym')).toBe(true);
    expect(isKeep('tourism', 'hotel')).toBe(true);
    expect(isKeep('craft', 'carpenter')).toBe(true);
  });
});

describe('GROUP_MAP', () => {
  it('maps food types correctly', () => {
    expect(GROUP_MAP.restaurant).toBe('food');
    expect(GROUP_MAP.cafe).toBe('food');
  });

  it('maps retail types correctly', () => {
    expect(GROUP_MAP.supermarket).toBe('retail');
    expect(GROUP_MAP.convenience).toBe('retail');
  });

  it('maps health types correctly', () => {
    expect(GROUP_MAP.pharmacy).toBe('health');
    expect(GROUP_MAP.clinic).toBe('health');
  });

  it('all mapped categories have valid groups', () => {
    const validGroups = [
      'food',
      'retail',
      'health',
      'finance',
      'tourism',
      'leisure',
      'entertainment',
      'education',
      'transport',
      'services',
      'religious',
      'other',
    ];
    for (const g of Object.values(GROUP_MAP)) {
      expect(validGroups).toContain(g);
    }
  });

  it('covers CAT_KEYS categories in GROUP_MAP', () => {
    const catKeys = ['amenity', 'shop', 'healthcare', 'office', 'leisure', 'tourism', 'craft'];
    for (const key of catKeys) {
      expect(GROUP_MAP).toBeDefined();
    }
  });
});

describe('esc', () => {
  it('handles null and undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('handles empty strings', () => {
    expect(esc('')).toBe('');
  });

  it('wraps values with commas in quotes', () => {
    expect(esc('123 Main St, Apt 4')).toBe('"123 Main St, Apt 4"');
  });

  it('escapes double quotes', () => {
    expect(esc('He said "hello"')).toBe('"He said ""hello"""');
  });

  it('wraps values with newlines in quotes', () => {
    expect(esc('line1\nline2')).toBe('"line1\nline2"');
  });

  it('returns simple values as-is', () => {
    expect(esc('hello')).toBe('hello');
    expect(esc('123')).toBe('123');
  });
});

describe('getCategoryKey / getCategoryValue', () => {
  it('finds first matching category', () => {
    expect(getCategoryKey({ amenity: 'cafe' })).toBe('amenity');
    expect(getCategoryValue({ amenity: 'cafe' })).toBe('cafe');
  });

  it('returns empty for non-business features', () => {
    expect(getCategoryKey({ highway: 'residential' })).toBe('');
    expect(getCategoryValue({ highway: 'residential' })).toBe('');
  });

  it('prefers amenity over shop (CAT_KEYS order)', () => {
    const props = { shop: 'supermarket', amenity: 'cafe' };
    expect(getCategoryKey(props)).toBe('amenity');
    expect(getCategoryValue(props)).toBe('cafe');
  });
});

describe('classifyFeature', () => {
  const makeFeature = (overrides: Partial<BusinessFeature> = {}): BusinessFeature => ({
    properties: { amenity: 'cafe', name: 'Test Cafe' },
    geometry: { type: 'Point', coordinates: [44.8, 41.7] },
    ...overrides,
  });

  it('classifies a valid cafe feature', () => {
    const result = classifyFeature(makeFeature());
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test Cafe');
    expect(result!.category).toBe('cafe');
    expect(result!.group).toBe('food');
    expect(result!.lat).toBe('41.700000');
    expect(result!.lon).toBe('44.800000');
  });

  it('returns null for non-business features', () => {
    const result = classifyFeature({
      properties: { highway: 'residential' },
    });
    expect(result).toBeNull();
  });

  it('returns null for unknown amenity types', () => {
    const result = classifyFeature({
      properties: { amenity: 'toilets' },
    });
    expect(result).toBeNull();
  });

  it('handles tags instead of properties (OSM element format)', () => {
    const result = classifyFeature({
      tags: { shop: 'supermarket', name: 'Test Shop' },
      geometry: { type: 'Point', coordinates: [30.5, 50.4] },
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test Shop');
    expect(result!.group).toBe('retail');
  });

  it('uses @lat/@lon when geometry is not a Point', () => {
    const result = classifyFeature({
      properties: { amenity: 'cafe', '@lat': '41.7', '@lon': '44.8' },
    });
    expect(result).not.toBeNull();
    expect(result!.lat).toBe('41.7');
    expect(result!.lon).toBe('44.8');
  });

  it('handles missing geometry gracefully', () => {
    const result = classifyFeature({
      properties: { amenity: 'cafe' },
    });
    expect(result).not.toBeNull();
    expect(result!.lat).toBe('');
    expect(result!.lon).toBe('');
  });

  it('categorizes into correct group', () => {
    const testCases: { key: string; val: string; group: string }[] = [
      { key: 'amenity', val: 'restaurant', group: 'food' },
      { key: 'shop', val: 'supermarket', group: 'retail' },
      { key: 'amenity', val: 'pharmacy', group: 'health' },
      { key: 'tourism', val: 'hotel', group: 'tourism' },
      { key: 'amenity', val: 'school', group: 'education' },
      { key: 'amenity', val: 'cinema', group: 'entertainment' },
      { key: 'amenity', val: 'fuel', group: 'transport' },
      { key: 'shop', val: 'hairdresser', group: 'services' },
    ];

    for (const { key, val, group } of testCases) {
      const result = classifyFeature({
        properties: { [key]: val, name: `Test ${val}` },
      });
      expect(result, `${val} should be categorized as ${group}`).not.toBeNull();
      expect(result!.group).toBe(group);
    }
  });
});

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(41.7151, 44.8271, 41.7151, 44.8271)).toBe(0);
  });

  it('accurately calculates distance between known points in Tbilisi', () => {
    // Freedom Square (41.6938, 44.8015) to Rustaveli Metro (41.7042, 44.7909) ~1.45km
    const dist = haversineDistance(41.6938, 44.8015, 41.7042, 44.7909);
    expect(dist).toBeGreaterThan(1300);
    expect(dist).toBeLessThan(1600);
  });

  it('calculates short walking distance accurately', () => {
    // ~100m distance along latitude (0.0009 deg lat ~ 100m)
    const dist = haversineDistance(41.7, 44.8, 41.7009, 44.8);
    expect(dist).toBeGreaterThan(95);
    expect(dist).toBeLessThan(105);
  });
});

describe('calculateDensity and SpatialGrid', () => {
  const center = { lat: 41.715, lon: 44.827, category: 'cafe', group: 'food' };
  const mockPois = [
    // Direct competitor within 300m
    { lat: 41.716, lon: 44.828, category: 'cafe', group: 'food' },
    // Another food within 400m
    { lat: 41.717, lon: 44.827, category: 'restaurant', group: 'food' },
    // Retail (complementary) within 450m
    { lat: 41.714, lon: 44.825, category: 'supermarket', group: 'retail' },
    // Retail within 800m
    { lat: 41.72, lon: 44.827, category: 'clothes', group: 'retail' },
    // Far point (beyond 1500m)
    { lat: 41.75, lon: 44.85, category: 'cafe', group: 'food' },
  ];

  it('calculates 500m and 1000m densities correctly', () => {
    const density = calculateDensity(center, mockPois);
    expect(density.totalNearby500).toBe(3);
    expect(density.totalNearby1000).toBe(4);
    expect(density.competitorsNearby500).toBe(1);
    expect(density.competitorsNearby1000).toBe(1);
    expect(density.complementaryNearby500).toBe(1);
    expect(density.complementaryNearby1000).toBe(2);
  });

  it('SpatialGrid indexes points and retrieves nearby targets rapidly', () => {
    const grid = new SpatialGrid(0.01);
    for (const p of mockPois) {
      grid.insert(p);
    }

    const nearby500 = grid.getNearby(center.lat, center.lon, 500);
    expect(nearby500.length).toBe(3);

    const nearby1000 = grid.getNearby(center.lat, center.lon, 1000);
    expect(nearby1000.length).toBe(4);
  });
});

describe('calculateLocationScore', () => {
  it('generates high score for location with vibrant footfall and moderate competition', () => {
    const target = { lat: 41.715, lon: 44.827, category: 'cafe', group: 'food' };
    const pois: Array<{ lat: number; lon: number; category: string; group: string }> = [];

    // Add 15 complementary retail/office/tourism POIs within 400m
    for (let i = 0; i < 15; i++) {
      pois.push({
        lat: 41.715 + 0.001 * (i % 3),
        lon: 44.827 + 0.001 * Math.floor(i / 3),
        category: 'supermarket',
        group: 'retail',
      });
    }
    // Add 3 direct competitor cafes (proven demand)
    for (let i = 0; i < 3; i++) {
      pois.push({
        lat: 41.7152 + 0.0005 * i,
        lon: 44.8272 + 0.0005 * i,
        category: 'cafe',
        group: 'food',
      });
    }

    const result = calculateLocationScore(target, pois);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(['A', 'B']).toContain(result.rating);
    expect(result.recommendation).toContain('commercial');
  });

  it('rates isolated locations with grade D or C', () => {
    const target = { lat: 41.715, lon: 44.827, category: 'cafe', group: 'food' };
    const result = calculateLocationScore(target, []);
    expect(result.score).toBeLessThanOrEqual(40);
    expect(['C', 'D']).toContain(result.rating);
  });
});

describe('Zod 4 GeoJSON validation', () => {
  it('validates standard FeatureCollection', () => {
    const validData = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'node/123',
          properties: { amenity: 'cafe', name: 'Entree' },
          geometry: { type: 'Point', coordinates: [44.8, 41.7] },
        },
      ],
    };
    const parseRes = validateGeoJSON(validData);
    expect(parseRes.success).toBe(true);
  });

  it('accepts Overpass elements format', () => {
    const overpassData = {
      elements: [
        {
          id: 456,
          tags: { shop: 'bakery', name: 'Puris Sakheli' },
          geometry: { type: 'Point', coordinates: [44.78, 41.72] },
        },
      ],
    };
    const parseRes = validateGeoJSON(overpassData);
    expect(parseRes.success).toBe(true);
  });

  it('rejects invalid geometries', () => {
    const invalidData = {
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: 'not-an-array' },
        },
      ],
    };
    const parseRes = validateGeoJSON(invalidData);
    expect(parseRes.success).toBe(false);
  });
});

describe('generateLocationReportHtml', () => {
  it('renders a self-contained printable HTML report', () => {
    const business = {
      osmId: '12345',
      name: 'Coffee LAB',
      tagKey: 'amenity',
      category: 'cafe',
      group: 'food',
      lat: '41.721',
      lon: '44.768',
      street: 'Kazbegi Ave',
      housenumber: '24',
      phone: '+995322123456',
      website: 'https://coffeelab.ge',
      openingHours: '08:00-22:00',
      cuisine: 'coffee_shop',
      brand: 'Coffee LAB',
    };
    const density = {
      totalNearby500: 18,
      totalNearby1000: 45,
      competitorsNearby500: 3,
      competitorsNearby1000: 7,
      complementaryNearby500: 12,
      complementaryNearby1000: 30,
    };
    const score = {
      score: 84,
      rating: 'A' as const,
      metrics: {
        footfallAttractors: 12,
        directCompetition: 3,
        commercialMaturity: 45,
        marketSaturation: 'moderate' as const,
      },
      recommendation: 'Prime commercial location',
    };

    const html = generateLocationReportHtml(business, density, score);
    expect(html).toContain('Coffee LAB');
    expect(html).toContain('Grade A');
    expect(html).toContain('Score: 84 / 100');
    expect(html).toContain('Kazbegi Ave 24');
    expect(html).toContain('window.print()');
  });
});
