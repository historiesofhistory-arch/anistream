# AniStream — Deployment Guide

A self-hosted anime streaming site (Vite + React frontend, Express backend).
Single-container Docker deployment — works on Render, Railway, Fly.io, or any
host that runs Docker.

---

## Quick start (local Docker)

```bash
# 1. Configure env
cp .env.example .env
# Edit .env — set WEB_DOMAIN to your site URL

# 2. Build & run
docker compose up --build

# 3. Open
# http://localhost:8080
```

---

## Deploy to Render

1. Push this repo to GitHub.
2. In Render dashboard → **New +** → **Web Service** → connect your repo.
3. Render auto-detects the `Dockerfile`. Accept the defaults.
4. In **Environment** tab, add:
   | Key         | Value                                      |
   | ----------- | ------------------------------------------ |
   | `WEB_DOMAIN`| `https://your-app.onrender.com`            |
   | `BASE_PATH` | `/`                                        |
   | `NODE_ENV`  | `production`                               |
   |
   Render auto-injects `PORT` — don't set it manually.
5. Deploy. Render builds the Docker image and serves it on your `*.onrender.com` URL.

### Custom domain on Render
**Settings → Custom Domains → Add Domain** → enter `stream-api.streams-anex.net`.
Render gives you a CNAME target. Add the CNAME record in your DNS provider.
Once DNS verifies, update the `WEB_DOMAIN` env var to `https://stream-api.streams-anex.net` and redeploy.

---

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway → **New Project** → **Deploy from GitHub repo** → select your repo.
3. Railway auto-detects the `Dockerfile`.
4. In **Variables** tab, add:
   | Key          | Value                                      |
   | ------------ | ------------------------------------------ |
   | `WEB_DOMAIN` | `https://your-app.up.railway.app`          |
   | `BASE_PATH`  | `/`                                        |
   | `NODE_ENV`   | `production`                               |
   |
   Railway auto-injects `PORT` — don't set it manually.
5. Deploy. Railway gives you a `*.up.railway.app` URL.

### Custom domain on Railway
**Settings → Networking → Generate Domain** → then **Add Custom Domain** →
enter `stream-api.streams-anex.net`. Add the CNAME record in your DNS.
Update `WEB_DOMAIN` env var to match and redeploy.

---

## Environment variables

| Variable           | Required | Default | Description                                                  |
| ------------------ | -------- | ------- | ------------------------------------------------------------ |
| `PORT`             | No*      | `8080`  | HTTP port. Render/Railway auto-inject.                       |
| `BASE_PATH`        | Yes      | `/`     | Vite base path. Use `/` for root deployment.                 |
| `WEB_DOMAIN`       | Rec.     | —       | Full URL for CORS lockdown (e.g. `https://stream-foo.streams-are-annex.net`). |
| `EMBED_API_URL`    | No       | Koyeb†  | Origin of YOUR hosted embed/stream API. Used by the Core, AniNico, and VidStream providers. Set this if you've hosted the embed API elsewhere. |
| `VITE_API_BASE_URL`| No       | empty   | BUILD-time. Set only if frontend should call a separate API origin directly. Leave empty for same-origin (normal full-stack Docker deploy). |
| `NODE_ENV`         | No       | `prod`  | `production` or `development`.                               |
| `STATIC_DIR`       | No       | —       | Set by Dockerfile. Don't override.                           |

\* Render and Railway inject `PORT` automatically. Local Docker uses `8080`.
† Defaults to `https://worthwhile-audrey-botnestbots-d45e9faf.koyeb.app` if `EMBED_API_URL` is unset.

### About `EMBED_API_URL`

The "Core" provider (the recommended default server) calls an embed API to resolve stream URLs. By default it points at the original Koyeb-hosted instance. If you've hosted your own copy of the embed API anywhere — Koyeb, Railway, Render, or your own domain like `https://stream-foo.anix.at` — set `EMBED_API_URL` to that origin and the backend will use it automatically. No code changes needed.

The AniNico and VidStream providers also use the same `EMBED_API_URL` (they all share the same upstream anix.at source).

---

## How it works

The Dockerfile is a 3-stage build:

1. **frontend-builder** — `pnpm install` + `vite build` → static files in `anistream/dist/public/`
2. **backend-builder** — `pnpm install` + `esbuild` → bundled server in `api-server/dist/index.mjs`
3. **runtime** — copies built frontend + backend into a slim Node image. Express serves `/api/*` routes AND the static frontend on the same port.

No Caddy, no nginx, no separate containers. One process, one port.

---

## Local development (without Docker)

The project is a pnpm workspace. You need two terminals:

```bash
# Terminal 1 — API server (port 8080)
cd artifacts/api-server
pnpm install
PORT=8080 pnpm run dev

# Terminal 2 — Vite dev server (port 3000)
cd artifacts/anistream
pnpm install
PORT=3000 BASE_PATH=/ pnpm run dev
```

Vite proxies `/api/*` to `localhost:8080` automatically (see `vite.config.ts`).
Open `http://localhost:3000` for hot-reload dev.

---

## Troubleshooting

**Build fails on `pnpm install`** — make sure you're using pnpm 9+ (`corepack enable && corepack prepare pnpm@9.15.0 --activate`). The `pnpm-workspace.yaml` enforces a 1-day minimum release age for security; if a brand-new package version is required, add it to `minimumReleaseAgeExclude`.

**CORS errors in browser** — set `WEB_DOMAIN` to your exact frontend URL (including `https://`). The backend locks CORS to this origin in production.

**Blank page on deployment** — check that `BASE_PATH` matches your deployment path. Root deployment = `/`. Subpath deployment = `/your-subpath/`.

**404 on /api routes** — the SPA catch-all might be intercepting them. Make sure your `app.ts` registers `/api` routes BEFORE the catch-all (it does by default).

**Embed streams don't load** — the embed-proxy does a server-side preflight with a 3.5s timeout. If the upstream is slow, the iframe watchdog (8s) shows a "Stream Unavailable" overlay. Try switching servers via the server selector.
