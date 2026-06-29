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

// Serve static files
const STATIC_FILES: Record<string, string> = {
  '/': 'index.html',
  '/styles.css': 'styles.css',
  '/script.js': 'script.js',
  '/businesses.csv': 'businesses.csv',
  '/businesses_summary.csv': 'businesses_summary.csv',
};

for (const [route, file] of Object.entries(STATIC_FILES)) {
  app.get(route, async (c) => {
    const filePath = join(ROOT, file);
    try {
      const content = await readFile(filePath);
      const ext = file.split('.').pop() || '';
      const mime: Record<string, string> = {
        html: 'text/html; charset=utf-8',
        css: 'text/css; charset=utf-8',
        js: 'application/javascript; charset=utf-8',
        csv: 'text/csv; charset=utf-8',
        geojson: 'application/geo+json; charset=utf-8',
        json: 'application/json; charset=utf-8',
      };
      return c.newResponse(content, 200, {
        'Content-Type': mime[ext] || 'application/octet-stream',
      });
    } catch {
      throw new HTTPException(404, { message: 'Not found' });
    }
  });
}

// Run process.ts on uploaded GeoJSON
const _generateSchema = z.object({
  inputFile: z.instanceof(File).refine((f) => f.size <= MAX_FILE_SIZE, 'File too large (max 50MB)'),
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

// Error handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ ok: false, error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ ok: false, error: 'Internal Server Error' }, 500);
});

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
