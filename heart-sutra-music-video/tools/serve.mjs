// A tiny static file server for the project folder (or another folder).
// Supports range requests, which audio seeking needs.
//   node tools/serve.mjs [port] [folder]   then open http://localhost:8080

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.ttf': 'font/ttf', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

export function serve(port = 8080, root = PROJECT) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
    let body;
    try { body = await readFile(file); } catch { res.writeHead(404); res.end('not found'); return; }
    const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? +range[1] : Math.max(0, body.length - +range[2]);
      const end = range[1] && range[2] ? Math.min(+range[2], body.length - 1) : body.length - 1;
      if (start >= body.length || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }); res.end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': end - start + 1 });
      res.end(body.subarray(start, end + 1));
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': body.length });
      res.end(body);
    }
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8080);
  await serve(port, process.argv[3] ? resolve(process.argv[3]) : PROJECT);
  console.log(`http://localhost:${port}`);
}
