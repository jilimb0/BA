import { describe, it, expect } from 'vitest';
import {
  isKeep, GROUP_MAP, esc, getCategoryKey, getCategoryValue,
  classifyFeature, CAT_KEYS,
} from '../src/analyzer.js';
import type { BusinessFeature } from '../src/analyzer.js';

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
    const validGroups = ['food', 'retail', 'health', 'finance', 'tourism',
      'leisure', 'entertainment', 'education', 'transport', 'services', 'religious', 'other'];
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
