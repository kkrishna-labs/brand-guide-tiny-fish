# Brand Guide Generator

Give it a company's website **or just its name**, and you get back a usable brand guide:
**logo (SVG wordmark), colour palette, typography, tone of voice, key messaging**
(+ brand elements, imagery, brand-asset pages).

Output: JSON (structured, schema-stable), Markdown (paste into a doc or deck),
HTML (visual guide with swatches), and **W3C design tokens** (import into
Figma Tokens Studio / Style Dictionary).

Built on [TinyFish](https://docs.tinyfish.ai/quickstart): **Search + Fetch** do the work,
and the **Agent** endpoint is optional.

## Demos (three brands, generated live)

| Brand | Input | Guide | Tokens |
|---|---|---|---|
| Stripe | `https://stripe.com` | [md](demos/stripe.com.brand.md) · [html](demos/stripe.com.brand.html) · [json](demos/stripe.com.brand.json) | [tokens](demos/stripe.com.tokens.json) |
| Linear | `https://linear.app` | [md](demos/linear.app.brand.md) · [html](demos/linear.app.brand.html) · [json](demos/linear.app.brand.json) | [tokens](demos/linear.app.tokens.json) |
| Patagonia | `"Patagonia"` (name only) | [md](demos/patagonia.com.brand.md) · [html](demos/patagonia.com.brand.html) · [json](demos/patagonia.com.brand.json) | [tokens](demos/patagonia.com.tokens.json) |

Spot-checked against the live sites: Stripe → Söhne (`sohne-var`), `#533AFD`/`#635BFF`;
Linear → Inter Variable + Berkeley Mono, `#5E6AD2`; Patagonia → Ridgeway Sans,
sprite-SVG wordmark, "Earth is now our only shareholder".

## How TinyFish is used

| Endpoint | What it does here |
|---|---|
| **Search** (`tinyfish search query`) | (1) Turns a company **name** into its official site (skipping Wikipedia, LinkedIn, app stores…). (2) Finds the brand's own **press-kit / brand-guideline / logo-asset pages**, which homepages often don't link to (e.g. `stripe.com/newsroom/information`). Those pages are fetched too and listed under `brandResources`. |
| **Fetch** (`tinyfish fetch content get`, markdown + html, batched) | Core extraction. Reads the live homepage, then about/brand/press pages found from its real links and conventional paths (≤10 pages). This gives the company name, tagline, description, image/logo links, **headlines, value propositions** (key messaging), tone of voice, mission/values and imagery. |
| **Agent** (`tinyfish agent run --output-schema-file`, optional) | `--mode full` / `--mode content`: a browser agent fills the same JSON schema for a richer reading of the copy. The default `fast` mode needs no agent and costs $0. |

The site's raw CSS is read in addition to Fetch, because Fetch returns cleaned
content without `<style>`/stylesheet links. Colours, fonts (with `var(--font-*)` resolved),
CTAs and the inline-SVG wordmark come from there.

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

# Just a company name — resolved to its official site via TinyFish Search:
node src/index.js "Patagonia" --format all

# Richer copy understanding via paid browser agent (~$0.016/step):
node src/index.js https://stripe.com --mode full --format all

# Middle ground: paid agent reads the fetched text (fewer steps than full):
node src/index.js https://stripe.com --mode content
```

Output lands in `./output/<host>.brand.{json,md,html}` + `<host>.tokens.json` (override with `-o`).
`--format json|markdown|html|tokens|all`.

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

0. **Search (free)**: company name → official site; `<brand> brand guidelines press kit logo`
   → same-domain brand/press pages added to the fetch list.
1. **Fetch (free)**: `tinyfish fetch content get <urls> --format markdown --links --image-links`
   plus `--format html` for CSS colors/fonts/logos. Homepage → discover
   about/brand/press pages from real links → probe conventional paths
   (batched, max 10 pages incl. Search hits).
2. **Extract** — `fast` parses everything locally (`src/local-extract.js`);
   `full`/`content` call `tinyfish agent run <goal> --url … --sync
   --output-schema-file … --browser-profile lite --session-id <uuid>`
   with the JSON schema in `src/brand-extractor.js`.
3. **Render**: `src/format.js` → JSON + Markdown + a visual HTML guide
   with palette swatches + W3C design tokens.

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
  index.js           CLI: `npm run cli -- <website> [--mode fast|content|full] [--format json|markdown|html|tokens|all]`; accepts a URL or company name
  server.js          web UI + API (`npm start` / `npm run ui`; Render startCommand)
  db.js              SQLite persistence (node:sqlite, zero deps; BRAND_DB_PATH)
  brand-extractor.js orchestration: discover pages → fetch → extract → finalize + confidence
  local-extract.js   free offline parser (logo/colors/fonts/tone/messaging/elements/imagery)
  raw-html.js        raw-HTML/CSS enrichment (SVG wordmark, palette, resolved fonts, CTAs)
  tinyfish-client.js TinyFish CLI wrapper (search/fetch/agent/wallet)
  format.js          Markdown + HTML + design-token renderers
public/              web UI (index.html, styles.css, app.js) — no build step
demos/               committed demo guides (Stripe, Linear, Patagonia)
output/              generated guides (gitignored)
tests/
  brand-extractor.test.js  unit tests for local parser + finalizer (node:test)
```
