import { describe, expect, it } from 'vitest';
import type { LocationScoreResult } from '../analyzer.js';
import { encodeGeohash, POIDatasetCache, SpatialScoreCache } from './spatial-cache.js';

describe('Spatial Geohash Encoding', () => {
  it('encodes lat/lon into geohash string with specified precision', () => {
    // Tbilisi coordinates ~ 41.6976, 44.7978
    const hash6 = encodeGeohash(41.6976, 44.7978, 6);
    expect(hash6).toHaveLength(6);

    const hash7 = encodeGeohash(41.6976, 44.7978, 7);
    expect(hash7).toHaveLength(7);
    expect(hash7.startsWith(hash6)).toBe(true);

    const hash8 = encodeGeohash(41.6976, 44.7978, 8);
    expect(hash8).toHaveLength(8);
    expect(hash8.startsWith(hash7)).toBe(true);
  });

  it('produces identical geohashes for coordinates in the same micro-cell', () => {
    const hashA = encodeGeohash(41.69761, 44.79781, 6);
    const hashB = encodeGeohash(41.69769, 44.79789, 6);
    expect(hashA).toBe(hashB);
  });
});

describe('SpatialScoreCache', () => {
  const dummyScore: LocationScoreResult = {
    score: 85,
    rating: 'A',
    metrics: {
      footfallAttractors: 20,
      directCompetition: 4,
      commercialMaturity: 15,
      marketSaturation: 'moderate',
    },
    recommendation: 'Prime commercial location',
  };

  it('caches location scores and returns cached value on subsequent get', () => {
    const cache = new SpatialScoreCache({ maxEntries: 10, defaultTtlMs: 5000 });
    expect(cache.get(41.6976, 44.7978, 'cafe', 'food')).toBeUndefined();

    cache.set(41.6976, 44.7978, 'cafe', 'food', dummyScore);

    const cached = cache.get(41.6976, 44.7978, 'cafe', 'food');
    expect(cached).toBeDefined();
    expect(cached?.score).toBe(85);
    expect(cached?.rating).toBe('A');

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('expires entries after TTL', async () => {
    const cache = new SpatialScoreCache({ maxEntries: 10, defaultTtlMs: 20 });
    cache.set(41.6976, 44.7978, 'cafe', 'food', dummyScore, 10);

    await new Promise((r) => setTimeout(r, 25));

    const cached = cache.get(41.6976, 44.7978, 'cafe', 'food');
    expect(cached).toBeUndefined();
  });

  it('evicts oldest entries when reaching maxEntries (LRU)', () => {
    const cache = new SpatialScoreCache({ maxEntries: 2 });
    cache.set(41.1, 44.1, 'cafe', 'food', dummyScore);
    cache.set(41.2, 44.2, 'shop', 'retail', dummyScore);
    expect(cache.getStats().size).toBe(2);

    // Access first entry to refresh LRU
    cache.get(41.1, 44.1, 'cafe', 'food');

    // Add 3rd entry -> should evict 41.2 (shop)
    cache.set(41.3, 44.3, 'bar', 'food', dummyScore);
    expect(cache.getStats().size).toBe(2);

    expect(cache.get(41.1, 44.1, 'cafe', 'food')).toBeDefined();
    expect(cache.get(41.2, 44.2, 'shop', 'retail')).toBeUndefined();
    expect(cache.get(41.3, 44.3, 'bar', 'food')).toBeDefined();
  });

  it('clears all cached entries', () => {
    const cache = new SpatialScoreCache();
    cache.set(41.1, 44.1, 'cafe', 'food', dummyScore);
    expect(cache.getStats().size).toBe(1);

    cache.clear();
    expect(cache.getStats().size).toBe(0);
    expect(cache.getStats().hits).toBe(0);
  });
});

describe('POIDatasetCache', () => {
  it('parses CSV rows and caches POIs in memory', async () => {
    const cache = new POIDatasetCache();
    const csv = `osm_id,name,tag_key,category,group,lat,lon,street,housenumber,phone,website,opening_hours,cuisine,brand
node/1,Cafe 1,amenity,cafe,food,41.697,44.797,Rustaveli,10,+995,http,24/7,coffee,Local
node/2,Shop 1,shop,convenience,retail,41.698,44.798,Rustaveli,12,+995,http,24/7,grocery,Local
`;
    // Access private parseCsv for deterministic test
    const parsed = cache.parseCsv(csv);
    expect(parsed.pois).toHaveLength(2);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.pois[0].category).toBe('cafe');
    expect(parsed.rows[0].name).toBe('Cafe 1');
  });

  it('handles empty or header-only CSV cleanly', () => {
    const cache = new POIDatasetCache();
    const emptyParsed = cache.parseCsv('');
    expect(emptyParsed.pois).toHaveLength(0);

    const headerOnly = cache.parseCsv('osm_id,lat,lon\n');
    expect(headerOnly.pois).toHaveLength(0);
  });
});
