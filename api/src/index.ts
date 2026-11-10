import { createApp } from "./app";
import { config } from "./config";
import { pool } from "./db";
import { redis } from "./redis";
import { storage } from "./storage";

/** Give Redis a moment to connect so the first requests get caching/pub-sub; never block startup on it. */
function waitForRedis(timeoutMs: number) {
  if (redis.status === "ready") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    redis.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  await storage.init();
  await waitForRedis(5000);
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[api] listening on :${config.port} (${config.nodeEnv}, storage=${config.storage.driver})`);
  });
  // SSE connections stay open; don't let Node's default timeouts cut them.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 0;

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close();
    server.closeAllConnections();
    Promise.allSettled([pool.end(), redis.quit()]).finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[api] failed to start", error);
  process.exit(1);
});
