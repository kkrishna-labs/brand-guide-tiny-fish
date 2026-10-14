# Deploy to Render

This app is a plain Node server (`src/server.js` + `public/`) with SQLite
persistence (`src/db.js`, built-in `node:sqlite` — no native addons). Two
things must be true in production: **Node 24+** and a **persistent disk**
(otherwise the `.db` file is wiped on every deploy/restart).

## Option A — Blueprint (recommended, 5 min)

1. Push this repo to GitHub.
2. Render dashboard → **New + → Blueprint** → select the repo.
   `render.yaml` creates the web service + 1 GB disk, sets
   `BRAND_DB_PATH=/var/data/guides.db`, and installs the TinyFish CLI.
3. When prompted, add the secret env var:
   `TINYFISH_API_KEY=sk-tinyfish-…` (marked `sync: false`, never committed).
4. Deploy. First boot runs migrations automatically (`CREATE TABLE IF NOT
   EXISTS`). Health check: `GET /api/wallet`.

## Option B — Manual

1. **New + → Web Service** → connect the repo.
   - Runtime: **Node**, Build: `npm ci && npm i -g @tiny-fish/cli`,
     Start: `node src/server.js`.
   - Instance: **Starter or higher** (Free has no disks — the DB would be
     ephemeral; see "Free-tier caveat" below).
2. **Environment tab** → add:
   - `TINYFISH_API_KEY` = your key (Secret).
   - `BRAND_DB_PATH` = `/var/data/guides.db`.
   - `NODE_VERSION` = `24` (Render default may be older; `node:sqlite`
     needs **Node ≥ 22.5**).
3. **Disks tab → Add Disk**: name `brand-data`, mount path `/var/data`,
   size 1 GB. Redeploy.

## Verify

```bash
curl https://<your-app>.onrender.com/api/wallet
curl -X POST https://<your-app>.onrender.com/api/extract \
  -H 'Content-Type: application/json' \
  -d '{"website":"https://example.com","mode":"fast"}'
curl https://<your-app>.onrender.com/api/guides
```

## Important notes

- **TinyFish CLI on Render.** `src/tinyfish-client.js` shells out to the
  `tinyfish` binary. The build installs it globally
  (`npm i -g @tiny-fish/cli`, v0.50.x). If the CLI ever fails to spawn,
  check logs for `TinyFish CLI failed` and confirm the build log shows the
  global install.
- **Free-tier caveat.** Without a disk, SQLite still works but resets on
  every deploy/restart. History endpoints keep working; data just doesn't
  survive. For real persistence use Starter + disk (as in `render.yaml`).
- **Cold starts.** Free/Starter sleeps when idle; first request after sleep
  takes ~30–60 s. Extraction itself takes 15–60 s per site — the UI shows
  progress; don't close the tab.
- **Costs.** `fast` mode = TinyFish fetch at $0/url + local parsing, so
  hosting is the only bill. `full`/`content` modes spend wallet
  (~$0.016/agent step) — set a mode default or gate those endpoints if the
  URL is public.
- **Backups.** Disk snapshots: Render dashboard → Disks → Snapshots.
  Or download any guide via `/api/guides/:id/{json,markdown,html}`.
- **Local prod check** (mirrors Render):
  `BRAND_DB_PATH=./data/guides.db PORT=3000 npm run ui`.
