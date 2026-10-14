#!/usr/bin/env node
/** Local web UI server — zero extra dependencies (built-in http only). */
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TinyFishClient } from './tinyfish-client.js';
import { BrandGuideExtractor } from './brand-extractor.js';
import { toMarkdown, toHTML } from './format.js';
import { openDb, saveGuide, listGuides, getGuide, deleteGuide } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 3000);

// Persistent storage. Local default ./data/guides.db; on Render set
// BRAND_DB_PATH=/var/data/guides.db (persistent disk mount).
const db = openDb();
console.log(`SQLite → ${process.env.BRAND_DB_PATH || './data/guides.db'}`);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, code, body, type = 'application/json') {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': buf.length });
  res.end(buf);
}

function serveStatic(req, res) {
  const urlPath = new URL(req.url, 'http://x').pathname;
  const file = urlPath === '/' ? 'index.html' : urlPath.slice(1).split('?')[0];
  // block path traversal
  if (file.includes('..') || file.includes('\\')) return send(res, 400, '{"error":"bad path"}');
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) return send(res, 400, '{"error":"bad path"}');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, '{"error":"not found"}');
    send(res, 200, data, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) reject(new Error('body too large')); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('invalid JSON body')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');

    if (req.method === 'GET' && (u.pathname === '/' || !u.pathname.startsWith('/api/'))) {
      return serveStatic(req, res);
    }
    if (req.method === 'GET' && u.pathname === '/api/wallet') {
      try {
        const wallet = await new TinyFishClient().getWallet();
        return send(res, 200, JSON.stringify(wallet));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: e.message }));
      }
    }
    if (req.method === 'POST' && u.pathname === '/api/extract') {
      let body;
      try { body = await readJson(req); }
      catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
      const website = (body.website || '').trim();
      const mode = ['fast', 'content', 'full'].includes(body.mode) ? body.mode : 'fast';
      if (!website) return send(res, 400, JSON.stringify({ error: 'website is required' }));
      try {
        const extractor = new BrandGuideExtractor(new TinyFishClient());
        const guide = await extractor.extract(website, { mode });
        const markdown = toMarkdown(guide);
        const id = saveGuide(db, {
          website,
          normalizedUrl: guide.company?.website || website,
          companyName: guide.company?.name || null,
          mode,
          guide,
          markdown,
          error: guide.error || null,
        });
        return send(res, 200, JSON.stringify({
          id,
          guide,
          markdown,
          html: toHTML(guide),
        }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: e.message }));
      }
    }
    if (req.method === 'GET' && u.pathname === '/api/guides') {
      const limit = Number(u.searchParams.get('limit') || 50);
      const offset = Number(u.searchParams.get('offset') || 0);
      const q = (u.searchParams.get('q') || '').trim();
      return send(res, 200, JSON.stringify(listGuides(db, { limit, offset, q })));
    }
    const guideId = u.pathname.match(/^\/api\/guides\/(\d+)(\/(markdown|html|json))?$/);
    if (guideId) {
      const row = getGuide(db, guideId[1]);
      if (!row) return send(res, 404, '{"error":"guide not found"}');
      const variant = guideId[3];
      if (req.method === 'GET' && !variant) {
        return send(res, 200, JSON.stringify({
          id: row.id,
          guide: row.guide,
          markdown: row.markdown,
          html: toHTML(row.guide),
          meta: {
            website: row.website, company_name: row.company_name,
            mode: row.mode, status: row.status, created_at: row.created_at,
          },
        }));
      }
      if (req.method === 'GET' && variant === 'markdown') {
        return send(res, 200, row.markdown || toMarkdown(row.guide), 'text/markdown; charset=utf-8');
      }
      if (req.method === 'GET' && variant === 'html') {
        return send(res, 200, toHTML(row.guide), 'text/html; charset=utf-8');
      }
      if (req.method === 'GET' && variant === 'json') {
        return send(res, 200, row.guide_json, 'application/json');
      }
      if (req.method === 'DELETE') {
        deleteGuide(db, guideId[1]);
        return send(res, 200, '{"ok":true}');
      }
    }
    return send(res, 404, '{"error":"not found"}');
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Brand Guide UI → http://localhost:${PORT}`);
  console.log(`API: POST /api/extract {website, mode} · GET /api/wallet`);
});
