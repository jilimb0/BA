const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function serveFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

function runProcess(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'process.ts', ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `process exited with ${code}`));
    });
  });
}

function parseMultipart(req, rawBody) {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(.+)$/);
  if (!match) throw new Error('Missing multipart boundary');
  const boundary = `--${match[1]}`;
  const parts = rawBody.split(boundary).filter(p => p.trim() && p.trim() !== '--');
  const fields = {};
  for (const part of parts) {
    const [rawHeaders, ...rest] = part.split('\r\n\r\n');
    const body = rest.join('\r\n\r\n').replace(/\r\n--$/, '').replace(/\r\n$/, '');
    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
    const name = nameMatch[1];
    if (filenameMatch) {
      fields[name] = { filename: filenameMatch[1], content: body };
    } else {
      fields[name] = body;
    }
  }
  return fields;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return serveFile(res, path.join(root, 'index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/styles.css') {
    return serveFile(res, path.join(root, 'styles.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/script.js') {
    return serveFile(res, path.join(root, 'script.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/businesses.csv') {
    return serveFile(res, path.join(root, 'businesses.csv'), 'text/csv; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/businesses_summary.csv') {
    return serveFile(res, path.join(root, 'businesses_summary.csv'), 'text/csv; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/raw.geojson') {
    return serveFile(res, path.join(root, 'raw.geojson'), 'application/geo+json; charset=utf-8');
  }

  if (req.method === 'POST' && url.pathname === '/generate') {
    try {
      const rawBody = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('binary')));
        req.on('error', reject);
      });
      const payload = parseMultipart(req, rawBody);
      const inputFile = payload.inputFile;
      if (!inputFile || !inputFile.content) throw new Error('GeoJSON file is required');
      const inputPath = path.join(root, '_uploaded.geojson');
      fs.writeFileSync(inputPath, inputFile.content, 'binary');

      const result = await runProcess([
        `--input=${path.basename(inputPath)}`,
        `--output=businesses.csv`,
        `--summary=businesses_summary.csv`,
        `--city=Businesses`,
      ]);

      send(res, 200, { ok: true, stdout: result.stdout, stderr: result.stderr });
    } catch (err) {
      send(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
