import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type ApiResponse = {
  ok?: boolean;
  error?: string;
  status?: string;
  project?: string;
  timestamp?: string;
};

// Set a unique port before importing server so module-level serve() doesn't conflict
process.env.PORT = '0';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const csvPath = join(ROOT, 'businesses.csv');
if (!existsSync(csvPath)) {
  const sampleCsv = `osm_id,name,tag_key,category,group,lat,lon,street,housenumber,phone,website,opening_hours,cuisine,brand,density_500m,density_1000m,location_score
way/25699483,Test School,amenity,school,education,41.697620,44.797843,Rustaveli Ave,10,+995 32 293 26 28,,,,,10,20,85
node/12345,Test Cafe,amenity,cafe,food,41.697500,44.797700,Rustaveli Ave,12,,,,,10,20,75
`;
  writeFileSync(csvPath, sampleCsv, 'utf-8');
}

const { app } = await import('./server.js');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse;
    expect(body.status).toBe('ok');
    expect(body.project).toBe('business-analyzer');
    expect(body.timestamp).toBeDefined();
  });
});

describe('POST /generate', () => {
  it('returns 400 when no file is provided', async () => {
    const formData = new FormData();
    const res = await app.request('/generate', {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error).toBe('GeoJSON file is required');
  });

  it('returns 400 when file has wrong extension', async () => {
    const formData = new FormData();
    const blob = new Blob(['{}'], { type: 'application/json' });
    const file = new File([blob], 'data.txt', { type: 'text/plain' });
    formData.append('inputFile', file);
    const res = await app.request('/generate', {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error).toContain('.geojson');
  });

  it('returns 400 when file exceeds size limit', async () => {
    const formData = new FormData();
    // 51MB blob
    const blob = new Blob(['x'.repeat(51 * 1024 * 1024)], { type: 'application/json' });
    const file = new File([blob], 'data.geojson', { type: 'application/geo+json' });
    formData.append('inputFile', file);
    const res = await app.request('/generate', {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error).toContain('too large');
  });
});

describe('Static files', () => {
  it('serves index.html from public/', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('serves widget.html from public/', async () => {
    const res = await app.request('/widget');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });
});

describe('Error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/nonexistent');
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiResponse;
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Not found');
  });
});

describe('GET /api/score', () => {
  it('returns 400 when lat/lon are missing or invalid', async () => {
    const res = await app.request('/api/score');
    expect(res.status).toBe(400);
  });

  it('calculates score and density for coordinates in dataset', async () => {
    const res = await app.request('/api/score?lat=41.6976&lon=44.7978&category=cafe&group=food');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      score: { score: number; rating: string };
      density: { totalNearby500: number };
    };
    expect(body.ok).toBe(true);
    expect(body.score).toBeDefined();
    expect(body.score.score).toBeGreaterThan(0);
    expect(body.density).toBeDefined();
  });
});

describe('GET /api/report', () => {
  it('returns 400 when osm_id is missing', async () => {
    const res = await app.request('/api/report');
    expect(res.status).toBe(400);
  });

  it('generates HTML location report for an existing business', async () => {
    // using known ID from businesses.csv
    const res = await app.request('/api/report?osm_id=way/25699483');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('Location Intelligence Report');
    expect(text).toContain('Grade');
  });
});
