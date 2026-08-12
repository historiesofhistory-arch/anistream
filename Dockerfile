# ─────────────────────────────────────────────────────────────────────────────
# AniStream — Production Dockerfile (single-container)
# ─────────────────────────────────────────────────────────────────────────────
# Builds the Vite frontend + Express backend into a single Node.js runtime.
# Express serves /api/* routes AND the built static frontend on the same port.
# Works on Render, Railway, Fly.io, plain Docker, anywhere that runs containers.
#
# Build:
#   docker build -t anistream .
#
# Run (local):
#   docker run -p 8080:8080 --env-file .env anistream
#
# Render / Railway: connect repo → auto-detects Dockerfile → set env vars in
# dashboard. Both platforms inject PORT automatically.
#
# Env vars (see .env.example):
#   PORT           — HTTP port (Render/Railway auto-inject; default 8080)
#   BASE_PATH      — Vite base path (almost always "/")
#   WEB_DOMAIN     — Your full site URL, e.g. "https://stream-foo.streams-anex.net"
#                    Used for CORS lockdown. Optional but recommended for prod.
#   EMBED_API_URL  — Origin of YOUR hosted embed/stream API. Defaults to the
#                    original Koyeb URL. Set this if you host the embed API
#                    elsewhere (Koyeb / Railway / your own domain).
#   VITE_API_BASE_URL — If you want the FRONTEND to call a separate API origin
#                       directly (instead of going through this backend's /api),
#                       set this at BUILD time. Leave empty for same-origin.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build frontend (Vite) ──────────────────────────────────────────
FROM node:22-slim AS frontend-builder

# Enable pnpm via corepack (no separate install step)
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /build

# Copy workspace root files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy all workspace package.json files so pnpm can resolve the workspace graph
COPY anistream/package.json    ./anistream/
COPY api-server/package.json   ./api-server/
COPY lib/api-client-react/package.json  ./lib/api-client-react/
COPY lib/api-spec/package.json          ./lib/api-spec/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/db/package.json                ./lib/db/
COPY scripts/package.json               ./scripts/

# Install ALL workspace deps in one shot (frozen lockfile = reproducible)
# Note: --ignore-scripts skips postinstall scripts (esbuild binary download)
# which we don't need at install time — esbuild is only used during build.
RUN pnpm install --frozen-lockfile --ignore-scripts || \
    pnpm install --no-frozen-lockfile --ignore-scripts

# Now copy the actual source
COPY anistream/    ./anistream/
COPY api-server/   ./api-server/
COPY lib/          ./lib/
COPY scripts/      ./scripts/

# Build the frontend → anistream/dist/public/
# Vite needs PORT + BASE_PATH env vars (see vite.config.ts).
# VITE_API_BASE_URL is read at BUILD time by src/lib/api.ts — pass through
# as a build arg so the frontend can be configured to call a separate API
# origin (e.g. when the frontend is deployed standalone without backend).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm --filter @workspace/anistream run build

# ── Stage 2: Build backend (esbuild) ────────────────────────────────────────
FROM node:22-slim AS backend-builder

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY anistream/package.json    ./anistream/
COPY api-server/package.json   ./api-server/
COPY lib/api-client-react/package.json  ./lib/api-client-react/
COPY lib/api-spec/package.json          ./lib/api-spec/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/db/package.json                ./lib/db/
COPY scripts/package.json               ./scripts/

RUN pnpm install --frozen-lockfile --ignore-scripts || \
    pnpm install --no-frozen-lockfile --ignore-scripts

COPY anistream/    ./anistream/
COPY api-server/   ./api-server/
COPY lib/          ./lib/
COPY scripts/      ./scripts/

# Build the backend → api-server/dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# ── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-slim AS runtime

# Production env defaults (can be overridden at runtime via -e or --env-file)
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
ENV STATIC_DIR=/app/public
# WEB_DOMAIN  — set to your site URL in .env (for CORS lockdown)
# EMBED_API_URL — set to your own hosted embed API origin in .env
#                 (defaults to the original Koyeb URL if unset)

WORKDIR /app

# Copy only the built backend bundle + its production node_modules
# (esbuild bundles most deps, so node_modules is small — just the externals)
COPY --from=backend-builder /build/api-server/dist         ./dist
COPY --from=backend-builder /build/api-server/package.json ./package.json

# Copy the built frontend (static assets)
COPY --from=frontend-builder /build/anistream/dist/public  ./public

# Install ONLY production deps for the backend (esbuild externals)
# Use --no-frozen-lockfile for compatibility across pnpm versions
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate && \
    pnpm install --prod --no-frozen-lockfile --ignore-scripts

# Healthcheck — hits the API health endpoint. Container is "healthy" once
# Express is up and responding.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 8080

# Run the bundled backend. Express serves /api/* AND static frontend.
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
