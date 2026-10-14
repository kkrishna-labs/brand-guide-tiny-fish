/**
 * SQLite persistence (built-in node:sqlite — zero new dependencies).
 * One table: guides. One row per extraction.
 *
 * DB path resolution:
 *   1. BRAND_DB_PATH env (Render disk mount, e.g. /var/data/guides.db)
 *   2. ./data/guides.db (local default, gitignored)
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS guides (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  website       TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  company_name  TEXT,
  mode          TEXT NOT NULL DEFAULT 'fast',
  status        TEXT NOT NULL DEFAULT 'ok',
  error         TEXT,
  guide_json    TEXT NOT NULL,
  markdown      TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_guides_website ON guides(website);
CREATE INDEX IF NOT EXISTS idx_guides_created ON guides(created_at DESC);
`;

export function resolveDbPath(explicit) {
  if (explicit) return explicit;
  if (process.env.BRAND_DB_PATH) return process.env.BRAND_DB_PATH;
  return path.join(process.cwd(), 'data', 'guides.db');
}

export function openDb(dbPath) {
  const file = resolveDbPath(dbPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

/** Insert a finished extraction. Returns the row id. */
export function saveGuide(db, { website, normalizedUrl, companyName, mode, guide, markdown, error = null }) {
  const stmt = db.prepare(`
    INSERT INTO guides (website, normalized_url, company_name, mode, status, error, guide_json, markdown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    website,
    normalizedUrl || website,
    companyName || null,
    mode || 'fast',
    error ? 'error' : 'ok',
    error,
    JSON.stringify(guide),
    markdown || ''
  );
  return Number(res.lastInsertRowid);
}

/** Lightweight rows for the history list (no blobs). */
export function listGuides(db, { limit = 50, offset = 0, q = '' } = {}) {
  const where = q ? 'WHERE website LIKE ? OR company_name LIKE ?' : '';
  const args = q ? [`%${q}%`, `%${q}%`] : [];
  const rows = db
    .prepare(
      `SELECT id, website, normalized_url, company_name, mode, status, created_at
       FROM guides ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...args, Math.min(limit, 200), Math.max(offset, 0));
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM guides ${where}`)
    .get(...args).n;
  return { rows, total: Number(total) };
}

export function getGuide(db, id) {
  const row = db.prepare('SELECT * FROM guides WHERE id = ?').get(Number(id));
  if (!row) return null;
  try {
    row.guide = JSON.parse(row.guide_json);
  } catch {
    row.guide = null;
  }
  return row;
}

export function deleteGuide(db, id) {
  const res = db.prepare('DELETE FROM guides WHERE id = ?').run(Number(id));
  return Number(res.changes);
}

export function countGuides(db) {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM guides').get().n);
}
