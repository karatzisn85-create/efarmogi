'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const HOST = '127.0.0.1';
const PORT = Number(process.env.E2E_HARNESS_PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers) {
  res.writeHead(status, headers || { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/e2e/harness/workspace.html' : urlPath;
    const resolved = path.resolve(ROOT, '.' + rel);
    if (!resolved.startsWith(ROOT)) {
      send(res, 403, 'Forbidden');
      return;
    }
    fs.readFile(resolved, (err, data) => {
      if (err) {
        send(res, 404, 'Not found');
        return;
      }
      const ext = path.extname(resolved);
      send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(PORT, HOST, () => {
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer()
    .then(() => {
      process.stdout.write(`E2E harness http://${HOST}:${PORT}\n`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { startServer, HOST, PORT, ROOT };
