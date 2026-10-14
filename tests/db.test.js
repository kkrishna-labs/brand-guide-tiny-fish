import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openDb, saveGuide, listGuides, getGuide, deleteGuide, countGuides, resolveDbPath } from '../src/db.js';

describe('db', () => {
  let tmp;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'branddb-')); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('saves, lists, gets and deletes guides', () => {
    const db = openDb(path.join(tmp, 'g.db'));
    const id = saveGuide(db, {
      website: 'https://acme.com', normalizedUrl: 'https://acme.com',
      companyName: 'Acme', mode: 'fast',
      guide: { company: { name: 'Acme' } }, markdown: '# Acme',
    });
    assert.equal(id, 1);
    assert.equal(countGuides(db), 1);
    const { rows, total } = listGuides(db, {});
    assert.equal(total, 1);
    assert.equal(rows[0].company_name, 'Acme');
    assert.ok(!('guide_json' in rows[0]), 'list rows stay light');
    const full = getGuide(db, id);
    assert.deepEqual(full.guide, { company: { name: 'Acme' } });
    assert.equal(deleteGuide(db, id), 1);
    assert.equal(countGuides(db), 0);
    assert.equal(getGuide(db, 999), null);
    db.close();
  });

  it('searches and paginates', () => {
    const db = openDb(path.join(tmp, 'g.db'));
    for (const w of ['https://a.com', 'https://b.com', 'https://c.com']) {
      saveGuide(db, { website: w, normalizedUrl: w, companyName: w, mode: 'fast', guide: {}, markdown: '' });
    }
    assert.equal(listGuides(db, { q: 'b.com' }).total, 1);
    assert.equal(listGuides(db, { limit: 2 }).rows.length, 2);
    assert.equal(listGuides(db, { limit: 2, offset: 2 }).rows.length, 1);
    // newest first
    assert.equal(listGuides(db, {}).rows[0].website, 'https://c.com');
    db.close();
  });

  it('creates parent dirs and honours BRAND_DB_PATH', () => {
    process.env.BRAND_DB_PATH = path.join(tmp, 'sub', 'x.db');
    const db = openDb();
    saveGuide(db, { website: 'w', normalizedUrl: 'w', companyName: null, mode: 'fast', guide: {}, markdown: '' });
    assert.ok(fs.existsSync(process.env.BRAND_DB_PATH));
    assert.equal(resolveDbPath(), process.env.BRAND_DB_PATH);
    db.close();
    delete process.env.BRAND_DB_PATH;
  });
});
