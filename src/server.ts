import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { z } from 'zod';
import type { BusinessRow, ReferencePOI } from './analyzer.js';
import {
  calculateDensity,
  calculateLocationScore,
  generateLocationReportHtml,
} from './analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const UPLOAD_DIR = join(ROOT, 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    project: 'business-analyzer',
    timestamp: new Date().toISOString(),
  });
});

// MIME type map
const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  geojson: 'application/geo+json; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

// Serve static files — frontend files from public/, data files from root
const STATIC_FILES: Record<string, string> = {
  '/': 'index.html',
  '/widget': 'widget.html',
  '/styles.css': 'styles.css',
  '/script.js': 'script.js',
  '/businesses.csv': 'businesses.csv',
  '/businesses_summary.csv': 'businesses_summary.csv',
};

const isPublicFile = (file: string) =>
  file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.js');

for (const [route, file] of Object.entries(STATIC_FILES)) {
  app.get(route, async (c) => {
    const baseDir = isPublicFile(file) ? join(ROOT, 'public') : ROOT;
    const filePath = join(baseDir, file);
    try {
      const content = await readFile(filePath);
      const ext = file.split('.').pop() || '';
      return c.newResponse(content, 200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
      });
    } catch {
      throw new HTTPException(404, { message: 'Not found' });
    }
  });
}

// Run process.ts on uploaded GeoJSON
const _generateSchema = z.object({
  inputFile: z
    .instanceof(File)
    .refine((f) => f.size <= MAX_FILE_SIZE, { error: 'File too large (max 50MB)' }),
});

app.post('/generate', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('inputFile');

  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: 'GeoJSON file is required' });
  }

  if (!file.name.endsWith('.geojson') && !file.name.endsWith('.json')) {
    throw new HTTPException(400, { message: 'File must be a .geojson or .json file' });
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new HTTPException(400, { message: 'File too large (max 50MB)' });
  }

  const tmpDir = await mkdtemp(join(UPLOAD_DIR, 'upload-'));
  const inputPath = join(tmpDir, 'input.geojson');
  const outputPath = join(ROOT, 'businesses.csv');
  const summaryPath = join(ROOT, 'businesses_summary.csv');

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'npx',
        [
          'tsx',
          'src/process.ts',
          `--input=${inputPath}`,
          `--output=${outputPath}`,
          `--summary=${summaryPath}`,
        ],
        {
          cwd: ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `process exited with ${code}`));
      });
    });

    return c.json({ ok: true });
  } finally {
    try {
      unlinkSync(inputPath);
    } catch {}
    try {
      unlink(tmpDir).catch(() => {});
    } catch {}
  }
});

// Location scoring API
const scoreQuerySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  category: z.string().optional(),
  group: z.string().optional(),
});

app.get('/api/score', async (c) => {
  const query = c.req.query();
  const parsed = scoreQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new HTTPException(400, { message: 'lat and lon are required numbers' });
  }

  const csvPath = join(ROOT, 'businesses.csv');
  if (!existsSync(csvPath)) {
    throw new HTTPException(404, { message: 'businesses.csv not generated yet' });
  }

  const csvContent = await readFile(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(Boolean);
  if (lines.length <= 1) {
    throw new HTTPException(400, { message: 'No businesses found in dataset' });
  }

  const header = lines[0].split(',');
  const latIdx = header.indexOf('lat');
  const lonIdx = header.indexOf('lon');
  const catIdx = header.indexOf('category');
  const grpIdx = header.indexOf('group');

  const pois: ReferencePOI[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const lat = Number.parseFloat(parts[latIdx]);
    const lon = Number.parseFloat(parts[lonIdx]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      pois.push({
        lat,
        lon,
        category: parts[catIdx],
        group: parts[grpIdx],
      });
    }
  }

  const target = {
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    category: parsed.data.category,
    group: parsed.data.group,
  };

  const density = calculateDensity(target, pois);
  const scoreResult = calculateLocationScore(target, pois);

  return c.json({
    ok: true,
    target,
    density,
    score: scoreResult,
  });
});

// Interactive location intelligence report API
app.get('/api/report', async (c) => {
  const osmId = c.req.query('osm_id');
  if (!osmId) {
    throw new HTTPException(400, { message: 'osm_id query parameter is required' });
  }

  const csvPath = join(ROOT, 'businesses.csv');
  if (!existsSync(csvPath)) {
    throw new HTTPException(404, { message: 'businesses.csv not generated yet' });
  }

  const csvContent = await readFile(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(Boolean);
  const header = lines[0].split(',');
  const idIdx = header.indexOf('osm_id');
  const latIdx = header.indexOf('lat');
  const lonIdx = header.indexOf('lon');
  const catIdx = header.indexOf('category');
  const grpIdx = header.indexOf('group');

  let matchedLine: string | null = null;
  const pois: ReferencePOI[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts[idIdx] === osmId || parts[idIdx] === `"${osmId}"`) {
      matchedLine = lines[i];
    }
    const lat = Number.parseFloat(parts[latIdx]);
    const lon = Number.parseFloat(parts[lonIdx]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      pois.push({
        lat,
        lon,
        category: parts[catIdx],
        group: parts[grpIdx],
      });
    }
  }

  if (!matchedLine) {
    throw new HTTPException(404, { message: `Business with osm_id ${osmId} not found` });
  }

  const cols = matchedLine.split(',');
  const getCol = (name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? (cols[idx] ?? '') : '';
  };

  const businessRow: BusinessRow = {
    osmId: getCol('osm_id'),
    name: getCol('name'),
    tagKey: getCol('tag_key'),
    category: getCol('category'),
    group: getCol('group'),
    lat: getCol('lat'),
    lon: getCol('lon'),
    street: getCol('street'),
    housenumber: getCol('housenumber'),
    phone: getCol('phone'),
    website: getCol('website'),
    openingHours: getCol('opening_hours'),
    cuisine: getCol('cuisine'),
    brand: getCol('brand'),
  };

  const target = {
    lat: Number.parseFloat(businessRow.lat),
    lon: Number.parseFloat(businessRow.lon),
    category: businessRow.category,
    group: businessRow.group,
  };

  const density = calculateDensity(target, pois);
  const scoreResult = calculateLocationScore(target, pois);

  const html = generateLocationReportHtml(businessRow, density, scoreResult);
  return c.html(html);
});

// Not-found handler (routes that don't match any static file or endpoint)
app.notFound((c) => {
  return c.json({ ok: false, error: 'Not found' }, 404);
});

// Error handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ ok: false, error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ ok: false, error: 'Internal Server Error' }, 500);
});

export { app };

// Graceful shutdown
let server: ReturnType<typeof serve> | null = null;

const port = Number(process.env.PORT ?? 3000);
server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BA running on http://localhost:${info.port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server?.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server?.close();
  process.exit(0);
});
