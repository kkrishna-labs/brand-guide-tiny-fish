# Brand Guide Generator

Give it a company's website → get back a usable brand guide:
**logo, colour palette, typography, tone of voice, key elements** (+ imagery).

Built on [TinyFish](https://docs.tinyfish.ai/quickstart) (`fetch content` + optional `agent run`).

## Setup

```bash
npm install
cp .env.example .env   # then paste your key (agent.tinyfish.ai/api-keys)
```

Requires the TinyFish CLI on PATH: `npm install -g @tiny-fish/cli`.
Key env var: `TINYFISH_API_KEY` (legacy `TINY_FISH_API_KEY` also works).

Check credits any time:

```bash
node src/index.js wallet
# or: tinyfish wallet status --pretty
```

## Usage

```bash
# Free default: TinyFish fetch (0 $/url) + local parsing — logo, colors,
# fonts, tone, mission/vision, imagery. ~15-30s.
node src/index.js https://stripe.com --format all

# Richer copy understanding via paid browser agent (~$0.016/step):
node src/index.js https://stripe.com --mode full --format all

# Middle ground: paid agent reads the fetched text (fewer steps than full):
node src/index.js https://stripe.com --mode content
```

Output lands in `./output/<host>.brand.{json,md,html}` (override with `-o`).

## Web UI

```bash
npm run ui
# → http://localhost:3000  (PORT=3001 npm run ui for another port)
```

Paste a URL, pick a mode, hit **Generate**. The page renders logo,
swatches, typography, tone, key elements, imagery and sources, with
**↓ JSON / Markdown / HTML** downloads. Wallet balance shows top-right.
No build step, no extra dependencies (`src/server.js` uses built-in `http`;
frontend is `public/`).

API (for your own frontends):
`POST /api/extract {website, mode}` → `{id, guide, markdown, html}`
(saved to SQLite); `GET /api/guides?q=&limit=&offset=` → history list;
`GET /api/guides/:id` (+ `/markdown`, `/html`, `/json` variants);
`DELETE /api/guides/:id`; `GET /api/wallet` → balance.

## Storage

SQLite via built-in `node:sqlite` (zero deps). DB file at
`./data/guides.db` locally, or wherever `BRAND_DB_PATH` points
(on Render: `/var/data/guides.db` on the persistent disk).
Schema auto-migrates on boot (`CREATE TABLE IF NOT EXISTS guides`).

## Deploy (Render)

Full guide: [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md). Short version:

1. Push to GitHub → Render **New + → Blueprint** → select repo
   (`render.yaml` wires service + disk + env).
2. Set secret `TINYFISH_API_KEY` in the dashboard.
3. Deploy; verify `/api/wallet` and `/api/guides`.
   Needs Starter+ instance (Free has no disks → DB resets on restart).

## How it works

1. **Fetch (free)** — `tinyfish fetch content get <urls> --format markdown --links --image-links`
   plus `--format html` for CSS colors/fonts/logos. Homepage → discover
   about/brand/press pages from real links → probe conventional paths
   (batched, max 8 pages).
2. **Extract** — `fast` parses everything locally (`src/local-extract.js`);
   `full`/`content` call `tinyfish agent run <goal> --url … --sync
   --output-schema-file … --browser-profile lite --session-id <uuid>`
   with the JSON schema in `src/brand-extractor.js`.
3. **Render** — `src/format.js` → JSON + Markdown + a visual HTML guide
   with palette swatches.

## TinyFish docs cheat-sheet

- Quickstart / auth / first automation: https://docs.tinyfish.ai/quickstart
- CLI surface used here (verified against `tinyfish --help`, v0.50.0):
  - `tinyfish fetch content get <urls...> --format markdown|html --links --image-links`
  - `tinyfish agent run [goal] --url <url> --sync --session-id <uuid> --output-schema-file <path> --browser-profile lite|stealth`
  - `tinyfish agent run list|get|cancel`, `tinyfish search query`, `tinyfish wallet status`
- Pricing seen on this account: Agent $0.016/step, Browser $0.002/min,
  **Fetch $0/url, Search $0/query**. `fast` mode therefore costs $0.

## Project layout

```
src/
  index.js           CLI: `npm run cli -- <website> [--mode fast|content|full] [--format json|markdown|html|all]`
  server.js          web UI + API (`npm start` / `npm run ui`; Render startCommand)
  db.js              SQLite persistence (node:sqlite, zero deps; BRAND_DB_PATH)
  brand-extractor.js orchestration: discover pages → fetch → extract → finalize + confidence
  local-extract.js   free offline parser (logo/colors/fonts/tone/elements/imagery)
  raw-html.js        raw-HTML/CSS enrichment for fast mode (exact favicon, palette, fonts)
  tinyfish-client.js TinyFish CLI wrapper (search/fetch/agent/wallet)
  format.js          Markdown + HTML renderers
public/              web UI (index.html, styles.css, app.js) — no build step
output/              generated guides (gitignored)
tests/
  brand-extractor.test.js  unit tests for local parser + finalizer (node:test)
```
