# 🎬 AniStream

Watch anime online — React + Vite frontend with Express backend. AniList for metadata, TVDB + just4anime for stylized logos, multi-provider streaming with Koyeb embed API.

![AniStream](https://img.shields.io/badge/AniStream-latest-red) ![React](https://img.shields.io/badge/React-19-blue) ![Vite](https://img.shields.io/badge/Vite-7-purple) ![Express](https://img.shields.io/badge/Express-5-green) ![Docker](https://img.shields.io/badge/Docker-ready-blue)

---

## ✨ Features

- **📅 Schedule Page** — AniList airing schedule, weekly view with IST timezone, day selector pills
- **🎥 Watch Page** — Multi-provider streaming (Core, VidStream, AniNico, ReAnime, AniDB)
- **🎨 Logo Loading Animation** — Stylized anime logo (TVDB clearlogo) with left-to-right wipe-reveal animation while stream loads
- **🔒 Domain Protection** — Koyeb/upstream URL is XOR-encrypted + base64 encoded, never exposed in HTTP responses
- **📺 Episode Data** — just4anime.online API (primary) with AniList+Kitsu fallback
- **🔍 Search** — Instant search with AniList, no wipe-out glitch
- **📱 Mobile-First** — Fully responsive, optimized for phone + desktop

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js 22+**
- **pnpm** (install via `npm install -g pnpm`)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/historiesofhistory-arch/anistream.git
cd anistream

# Install dependencies
pnpm install

# Build the backend
pnpm --filter @workspace/api-server run build

# Build the frontend
pnpm --filter @workspace/anistream run build

# Start the server (port 3000)
PORT=3000 \
NODE_ENV=development \
STATIC_DIR=./anistream/dist/public \
PROXY_SECRET=any-random-string-here \
node --enable-source-maps ./api-server/dist/index.mjs
```

Open `http://localhost:3000` — the Express server serves both the API (`/api/*`) and the built frontend.

### Dev Mode (Hot Reload)

```bash
# Terminal 1: Start backend dev server
pnpm --filter @workspace/api-server run dev

# Terminal 2: Start Vite dev server (port 3000, proxies /api to 8080)
pnpm --filter @workspace/anistream run dev
```

Open `http://localhost:3000` (Vite) — API calls proxy to `http://localhost:8080`.

---

## 🌐 Deployment

### Option 1: Render (Recommended — Free Tier)

1. Go to [render.com](https://render.com) → New → **Blueprint**
2. Connect your GitHub repo (`historiesofhistory-arch/anistream`)
3. Render auto-detects `render.yaml` — click **Apply**
4. Set these environment variables in the Render dashboard:

| Variable | Value | Required |
|----------|-------|----------|
| `EMBED_API_URL` | `https://your-api-domain.koyeb.app` (or your custom domain) | ✅ |
| `PROXY_SECRET` | Any random string (e.g., `my-secret-key-123`) | ✅ |
| `WEB_DOMAIN` | `https://your-app.onrender.com` (your Render URL) | Optional |
| `NODE_ENV` | `production` | Auto-set |
| `PORT` | Auto-injected by Render | Auto-set |

5. Deploy — Render builds via Dockerfile and runs `node --enable-source-maps dist/index.mjs`

### Option 2: Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Connect your GitHub repo (`historiesofhistory-arch/anistream`)
3. Railway auto-detects `railway.json` + `Dockerfile`
4. Set the same environment variables as above (Variables tab)
5. Deploy — Railway builds via Dockerfile

### Option 3: Docker (Any Host)

```bash
# Build the image
docker build -t anistream .

# Run the container
docker run -p 8080:8080 \
  -e EMBED_API_URL=https://your-api-domain.koyeb.app \
  -e PROXY_SECRET=your-secret-key \
  -e WEB_DOMAIN=https://your-domain.com \
  anistream
```

### Option 4: Docker Compose

```bash
docker-compose up -d
```

---

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP port | `8080` (Docker) / `3000` (dev) | Auto (Render/Railway) |
| `NODE_ENV` | `production` or `development` | `production` | ✅ |
| `EMBED_API_URL` | Origin of your hosted embed/stream API | Koyeb default URL | ✅ (for production) |
| `PROXY_SECRET` | Secret key for signing proxy URLs | — (required in production) | ✅ |
| `WEB_DOMAIN` | Your site URL (for CORS lockdown) | Empty (open CORS in dev) | Optional |
| `BASE_PATH` | Vite base path | `/` | Optional |
| `STATIC_DIR` | Path to built frontend | `/app/public` (Docker) | Auto (Docker) |
| `VITE_API_BASE_URL` | Frontend → separate API origin (build-time) | Empty (same-origin) | Optional |

---

## 🏗️ Architecture

```
anistream/
├── anistream/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/             # Home, Watch, Schedule, Search, Browse, Details
│   │   ├── components/        # AnimeCard, Layout, UI components
│   │   ├── lib/               # API client, transitions, utils
│   │   ├── App.tsx            # Router + page transitions
│   │   └── index.css          # Global styles + wipe-reveal keyframes
│   ├── vite.config.ts
│   └── package.json
│
├── api-server/                # Backend (Express 5)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── anime.ts       # All /api/anime/* endpoints
│   │   │   ├── proxy.ts       # HLS proxy + embed-proxy
│   │   │   └── health.ts      # Health check
│   │   ├── anivexa/
│   │   │   ├── providers/     # Core, VidStream, AniNico, ReAnime, AniDB, etc.
│   │   │   ├── core/          # AniList, TVDB, embed-token-store, mapper
│   │   │   └── stream-handler.js
│   │   ├── app.ts             # Express app setup
│   │   └── index.ts           # Server entry
│   ├── build.mjs              # esbuild config
│   └── package.json
│
├── lib/                       # Shared workspace packages
│   ├── api-client-react/
│   ├── api-spec/
│   ├── api-zod/
│   └── db/
│
├── Dockerfile                 # Multi-stage build (frontend + backend → runtime)
├── docker-compose.yml
├── render.yaml                # Render blueprint
├── railway.json               # Railway config
├── pnpm-workspace.yaml
└── package.json
```

---

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check (returns `{ status: "ok" }`) |
| `GET /api/home` | Homepage data (hero, sections, genres) |
| `GET /api/anime/trending` | Trending anime |
| `GET /api/anime/search?q=` | Search anime by title |
| `GET /api/anime/schedule?date=&tz=` | Weekly schedule (AniList) |
| `GET /api/anime/:id/details` | Anime details |
| `GET /api/anime/:id/episodes` | Episode list (just4anime → AniList+Kitsu fallback) |
| `GET /api/anime/:id/logo` | TVDB clearlogo URL (just4anime → TVDB → null) |
| `GET /api/anime/:id/stream/:epNum?lang=&provider=` | Stream URL (token-gated) |
| `GET /api/anime/:id/audio-options/:epNum?provider=` | Available audio tracks |
| `GET /api/anime/:id/skip-times/:epNum` | Intro/outro skip times |
| `GET /api/embed-proxy?t=` | Embed player shell (XOR-encrypted URL) |
| `GET /api/upcoming` | Upcoming anime |
| `GET /api/browse?page=` | Browse anime |

---

## 🎨 Logo Loading Animation

The watch page shows a stylized anime logo while the stream loads:

1. **Logo source:** TVDB clearlogo (via just4anime API → TVDB fallback)
2. **Animation:** Left-to-right wipe-reveal — bright version sweeps across dim version
3. **Duration:** 3 seconds minimum, then fades out when iframe loads
4. **Fallback:** If no logo available, shows a pulsing dot

---

## 🔒 Security

- **Koyeb domain hidden:** Upstream URL is XOR-encrypted with the token as key, then base64-encoded, embedded directly in the embed-proxy HTML. Never appears as plain text in any HTTP response.
- **`/api/embed-resolve` removed:** Previously leaked the URL as JSON — now returns 404.
- **Token-gated streams:** Each stream URL is stored server-side under a 4-hour TTL token. Browser only receives the token, never the actual upstream URL.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, Framer Motion, Vidstack, hls.js |
| Backend | Express 5, TypeScript, esbuild, pino (logging) |
| Player | Vidstack (HLS), iframe (embed) |
| Data Sources | AniList, TVDB, just4anime.online, Kitsu, AniSkip |
| Deployment | Docker, Render, Railway |
| Package Manager | pnpm (workspace) |

---

## 📝 License

MIT — feel free to use, modify, and distribute.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## ⚠️ Disclaimer

This site does not store any files on its server. All contents are provided by non-affiliated third parties. For educational purposes only.
