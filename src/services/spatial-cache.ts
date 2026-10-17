import { readFile, stat } from 'node:fs/promises';
import type { BusinessRow, LocationScoreResult, ReferencePOI } from '../analyzer.js';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encodes latitude and longitude into a standard base32 Geohash.
 * Precision:
 * - 6: ~1.2 km x 0.61 km (neighborhood / district level)
 * - 7: ~153 m x 153 m (street / block level)
 * - 8: ~38 m x 19 m (building / micro-location level)
 */
export function encodeGeohash(lat: number, lon: number, precision = 7): string {
  let latMin = -90.0;
  let latMax = 90.0;
  let lonMin = -180.0;
  let lonMax = 180.0;

  let geohash = '';
  let bits = 0;
  let charIdx = 0;
  let isEven = true; // start with longitude

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        charIdx = (charIdx << 1) | 1;
        lonMin = mid;
      } else {
        charIdx = (charIdx << 1) | 0;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        charIdx = (charIdx << 1) | 1;
        latMin = mid;
      } else {
        charIdx = (charIdx << 1) | 0;
        latMax = mid;
      }
    }

    isEven = !isEven;
    bits++;

    if (bits === 5) {
      geohash += BASE32[charIdx];
      bits = 0;
      charIdx = 0;
    }
  }

  return geohash;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface SpatialCacheStats {
  hits: number;
  misses: number;
  size: number;
  maxEntries: number;
}

/**
 * In-memory TTL / LRU Spatial Cache for Location Evaluation Scores.
 * Reuses computed scores for requests falling into the same Geohash bucket.
 */
export class SpatialScoreCache {
  private cache = new Map<string, CacheEntry<LocationScoreResult>>();
  private hits = 0;
  private misses = 0;
  private maxEntries: number;
  private defaultTtlMs: number;
  private geohashPrecision: number;

  constructor(options?: { maxEntries?: number; defaultTtlMs?: number; precision?: number }) {
    this.maxEntries = options?.maxEntries ?? 5000;
    this.defaultTtlMs = options?.defaultTtlMs ?? 15 * 60 * 1000; // 15 minutes
    this.geohashPrecision = options?.precision ?? 7;
  }

  public getCacheKey(
    lat: number,
    lon: number,
    category = 'all',
    group = 'all',
    precision?: number,
  ): string {
    const hash = encodeGeohash(lat, lon, precision ?? this.geohashPrecision);
    return `${hash}:${category.toLowerCase()}:${group.toLowerCase()}`;
  }

  public get(
    lat: number,
    lon: number,
    category = 'all',
    group = 'all',
  ): LocationScoreResult | undefined {
    const key = this.getCacheKey(lat, lon, category, group);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move key to end to maintain LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  public set(
    lat: number,
    lon: number,
    category: string,
    group: string,
    value: LocationScoreResult,
    ttlMs?: number,
  ): void {
    const key = this.getCacheKey(lat, lon, category, group);
    const ttl = ttlMs ?? this.defaultTtlMs;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (LRU)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  public getStats(): SpatialCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Cached parsed POI dataset with mtime invalidation.
 * Avoids reading and parsing 1.6MB CSV on every incoming HTTP request.
 */
export class POIDatasetCache {
  private cachedPois: ReferencePOI[] | null = null;
  private cachedRows: BusinessRow[] | null = null;
  private lastMtimeMs = 0;
  private lastFilePath = '';

  public async getDataset(csvPath: string): Promise<{
    pois: ReferencePOI[];
    rows: BusinessRow[];
  }> {
    try {
      const fileStat = await stat(csvPath);
      if (
        this.cachedPois &&
        this.cachedRows &&
        this.lastFilePath === csvPath &&
        this.lastMtimeMs === fileStat.mtimeMs
      ) {
        return { pois: this.cachedPois, rows: this.cachedRows };
      }

      const content = await readFile(csvPath, 'utf-8');
      const { pois, rows } = this.parseCsv(content);

      this.cachedPois = pois;
      this.cachedRows = rows;
      this.lastMtimeMs = fileStat.mtimeMs;
      this.lastFilePath = csvPath;

      return { pois, rows };
    } catch (err) {
      console.warn('[SpatialCache-ReadError]', err);
      return { pois: [], rows: [] };
    }
  }

  public invalidate(): void {
    this.cachedPois = null;
    this.cachedRows = null;
    this.lastMtimeMs = 0;
    this.lastFilePath = '';
  }

  public parseCsv(csvContent: string): { pois: ReferencePOI[]; rows: BusinessRow[] } {
    const lines = csvContent.split('\n').filter(Boolean);
    if (lines.length <= 1) {
      return { pois: [], rows: [] };
    }

    const header = lines[0].split(',');
    const idIdx = header.indexOf('osm_id');
    const nameIdx = header.indexOf('name');
    const tagKeyIdx = header.indexOf('tag_key');
    const catIdx = header.indexOf('category');
    const grpIdx = header.indexOf('group');
    const latIdx = header.indexOf('lat');
    const lonIdx = header.indexOf('lon');
    const streetIdx = header.indexOf('street');
    const houseIdx = header.indexOf('housenumber');
    const phoneIdx = header.indexOf('phone');
    const webIdx = header.indexOf('website');
    const hoursIdx = header.indexOf('opening_hours');
    const cuisineIdx = header.indexOf('cuisine');
    const brandIdx = header.indexOf('brand');

    const pois: ReferencePOI[] = [];
    const rows: BusinessRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      const lat = Number.parseFloat(parts[latIdx]);
      const lon = Number.parseFloat(parts[lonIdx]);

      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        const category = parts[catIdx] || '';
        const group = parts[grpIdx] || '';

        pois.push({ lat, lon, category, group });
        rows.push({
          osmId: idIdx >= 0 ? parts[idIdx] || '' : '',
          name: nameIdx >= 0 ? parts[nameIdx] || '' : '',
          tagKey: tagKeyIdx >= 0 ? parts[tagKeyIdx] || '' : '',
          category,
          group,
          lat: parts[latIdx] || '',
          lon: parts[lonIdx] || '',
          street: streetIdx >= 0 ? parts[streetIdx] || '' : '',
          housenumber: houseIdx >= 0 ? parts[houseIdx] || '' : '',
          phone: phoneIdx >= 0 ? parts[phoneIdx] || '' : '',
          website: webIdx >= 0 ? parts[webIdx] || '' : '',
          openingHours: hoursIdx >= 0 ? parts[hoursIdx] || '' : '',
          cuisine: cuisineIdx >= 0 ? parts[cuisineIdx] || '' : '',
          brand: brandIdx >= 0 ? parts[brandIdx] || '' : '',
        });
      }
    }

    return { pois, rows };
  }
}

export const globalSpatialCache = new SpatialScoreCache();
export const globalPoiDatasetCache = new POIDatasetCache();
