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

## Option B — Manual Web Service (Blueprint ke bina)

> Sabse pehle ye commit push karo (neeche "Kya fix hua" dekho) — uske bina
> purana build dobara fail hoga.

1. Dashboard → **New + → Web Service** → repo
   `kkrishna-labs/brand-guide-tiny-fish` select karo, branch `main`.
2. **Settings me ye bharo** (copy-paste karo, haath se type mat karo):
   - **Name:** `brand-guide-generator`
   - **Language / Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `node src/server.js`
   - **Instance Type:** `Starter` (Free par disk nahi milta — DB restart
     par ud jayegi)
   - **Health Check Path:** `/api/wallet`
3. **Environment → Add Environment Variable:**
   | Key | Value |
   |---|---|
   | `TINYFISH_API_KEY` | `sk-tinyfish-...` (tumhari key, Secret banao) |
   | `BRAND_DB_PATH` | `/var/data/guides.db` |
   | `NODE_VERSION` | `24` |
4. **Disks (left sidebar) → Add Disk:**
   - Name: `brand-data`, Mount Path: `/var/data`, Size: `1 GB`
   - Save karte hi Render **redeploy** karega.
5. Deploy log me ye dikhna chahiye:
   `==> Running build command 'npm ci'...` phir `added N packages`,
   aur start par `Brand Guide UI → http://localhost:10000` jaisa message.
   (Render `PORT` khud deta hai — code wahi use karta hai.)

> Blueprint use kar rahe ho to kuch karne ki zaroorat nahi — `render.yaml`
> me ab `buildCommand: npm ci` hai, CLI `package.json` se aata hai.

## Verify

```bash
curl https://<your-app>.onrender.com/api/wallet
curl -X POST https://<your-app>.onrender.com/api/extract \
  -H 'Content-Type: application/json' \
  -d '{"website":"https://example.com","mode":"fast"}'
curl https://<your-app>.onrender.com/api/guides
```

## Important notes

- **TinyFish CLI on Render.** `@tiny-fish/cli` ab `package.json` ki
  `dependencies` me hai (`^0.50.1`), isliye `npm ci` use `node_modules/.bin`
  me install kar deta hai. `src/tinyfish-client.js` sabse pehle wahi local
  binary dhoondhta hai — `npm i -g` ki zaroorat nahi, aur global PATH wali
  problem khatam. Agar `TinyFish CLI failed` dikhe to build log me
  `@tiny-fish/cli` install hua ya nahi, ye check karo.
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
