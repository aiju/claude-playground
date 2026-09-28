// Serves the real-time preview at http://localhost:8123/ .
//   node serve.js [port]
//
// player.html is written as a page body (that's the form the published
// preview takes), so it's wrapped in a document here.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

const wrap = (body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>body{margin:0}[hidden]{display:none!important}</style></head><body>
${body}
</body></html>`;

export function serve(port = 8123) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'player.html';
    const file = path.resolve(here, rel);
    if (!file.startsWith(here + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    let body = fs.readFileSync(file);
    if (rel === 'player.html') body = wrap(body.toString());
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] || 8123);
  await serve(port);
  console.log(`Preview: http://localhost:${port}/`);
}
