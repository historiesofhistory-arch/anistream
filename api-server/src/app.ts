import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS ────────────────────────────────────────────────────────────────────
// In production (Docker / Render / Railway), set WEB_DOMAIN to your frontend
// domain (e.g. "https://stream-api.streams-anex.net") so CORS is locked down
// to just your site. In dev, fall back to wildcard CORS so Vite (port 3000)
// can hit the API (port 8080) without config.
const webDomain = process.env.WEB_DOMAIN;
if (webDomain) {
  app.use(cors({ origin: webDomain, credentials: true }));
  logger.info({ webDomain }, "CORS locked to WEB_DOMAIN");
} else {
  app.use(cors());
  logger.info("CORS open (dev mode — set WEB_DOMAIN in production)");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Static frontend serving (production / Docker) ───────────────────────────
// When STATIC_DIR is set (Docker build bakes the frontend into /app/public),
// Express serves the built Vite assets and falls back to index.html for any
// non-/api route — standard SPA hosting setup. In dev, STATIC_DIR is unset
// and Vite handles frontend serving on its own port.
const staticDir = process.env.STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  logger.info({ staticDir }, "Serving static frontend");

  // Serve static assets (JS, CSS, images, fonts) with long cache headers
  app.use(
    express.static(staticDir, {
      maxAge: "1y",
      immutable: true,
      index: false, // don't serve index.html for "/" — we handle it below
    }),
  );

  // SPA catch-all: any non-/api route serves index.html so client-side
  // routing (wouter) handles deep links like /watch/123/456.
  // index.html is served with `no-cache` so the browser ALWAYS fetches a
  // fresh copy — this guarantees new deploys are picked up immediately
  // instead of showing stale skeletons from a cached old bundle URL.
  app.get("*splat", (_req: Request, res: Response) => {
    const indexHtml = path.join(staticDir, "index.html");
    if (fs.existsSync(indexHtml)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(indexHtml);
    } else {
      res.status(404).send("Not found");
    }
  });
}

export default app;
