import app from "./app";
import { logger } from "./lib/logger";

// Default to 8080 in production (Docker / Render / Railway). In dev, the
// start script sets PORT=8080 explicitly anyway. Render/Railway auto-inject
// PORT for the container's external port, which we WANT to honour — so the
// override via env still works.
const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
