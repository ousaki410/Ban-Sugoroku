import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'mobile');
const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml'
};

// 內存級輕量對局室狀態表（支援雙人透過四字雅號房間口令同步盤面與長輪詢/SSE）
const rooms = new Map();

function cleanExpiredRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.updatedAt > 3600_000) rooms.delete(code);
  }
}
setInterval(cleanExpiredRooms, 300_000).unref();

const server = http.createServer((req, res) => {
  // CORS 支援（允許 Cloudflare Pages 前端跨域調用 Galaxy Cloud 後端 API）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. Galaxy Cloud 容器健康檢查與狀態接口
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', activeRooms: rooms.size, uptime: process.uptime() }));
    return;
  }

  // 2. 服務端加密級公平擲骰與雙人房間狀態同步接口
  if (url.pathname === '/api/room' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { if (body.length < 32768) body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const code = String(data.roomCode || '東山御物').slice(0, 12);
        let room = rooms.get(code);
        if (!room) {
          room = { code, eraIdx: data.eraIdx ?? 2, state: null, seq: 0, updatedAt: Date.now() };
          rooms.set(code, room);
        }
        if (data.action === 'roll') {
          const d1 = crypto.randomInt(1, 7);
          const d2 = crypto.randomInt(1, 7);
          room.lastDice = [d1, d2];
          room.seq++;
          room.updatedAt = Date.now();
        } else if (data.action === 'sync' && data.state) {
          room.state = data.state;
          room.seq++;
          room.updatedAt = Date.now();
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(room));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid payload' }));
      }
    });
    return;
  }

  // 3. 靜態資源服務（直接將根路徑映射至 mobile/ 目錄）
  let reqPath = decodeURIComponent(url.pathname);
  if (reqPath === '/' || reqPath === '/mobile' || reqPath === '/mobile/') {
    reqPath = '/index.html';
  } else if (reqPath.startsWith('/mobile/')) {
    reqPath = reqPath.slice('/mobile'.length);
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheHeader = ext === '.woff2'
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=60';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': cacheHeader
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Ban-Sugoroku server listening on http://0.0.0.0:${PORT}`);
});
