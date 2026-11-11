import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { requireAuth, requireRole } from "./auth";
import { config } from "./config";
import { pool } from "./db";
import { idempotency } from "./idempotency";
import { errorHandler } from "./errors";
import { rateLimitHit, redis } from "./redis";
import { adminRouter, sessionRouter } from "./routes/admin";
import { assessmentsRouter } from "./routes/assessments";
import { committeeRouter } from "./routes/committee";
import { filesRouter, uploadsRouter } from "./routes/files";
import { lookupsRouter } from "./routes/lookups";
import { miscRouter } from "./routes/misc";
import { adminToolsRouter } from "./routes/adminTools";
import { offlineRouter } from "./routes/offline";
import { partnersRouter } from "./routes/partners";
import { reportsRouter } from "./routes/reports";
import { studentsRouter } from "./routes/students";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Only needed when the web app is served from a different origin than the
  // API (the default reverse-proxy setup keeps both on one origin).
  if (config.corsOrigins.length > 0) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      if (origin && config.corsOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  app.get("/api/health", async (_req, res) => {
    const [dbOk, redisOk] = await Promise.all([
      pool.query("select 1").then(() => true, () => false),
      redis.ping().then(() => true, () => false),
    ]);
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? "ok" : "degraded", database: dbOk, redis: redisOk });
  });

  if (config.rateLimitPerMinute > 0) {
    app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
      // Image downloads are cacheable and plentiful on list pages; don't count them.
      if (req.method === "GET" && req.path.startsWith("/v1/files/")) return next();
      if (await rateLimitHit(`ip:${req.ip}`, config.rateLimitPerMinute, 60)) return next();
      res.status(429).json({ error: "Too many requests, slow down." });
    });
  }

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Same paths the Next.js route handlers used, so existing callers keep working.
  app.use("/api/auth", sessionRouter);
  app.use("/api/admin", requireAuth, requireRole("super_admin"), adminRouter);

  // Public logos/avatars + RLS-checked private student documents.
  app.use("/api/v1/files", filesRouter);

  const v1 = express.Router();
  v1.use(requireAuth);
  v1.use(idempotency);
  v1.use("/offline", offlineRouter);
  v1.use("/uploads", uploadsRouter);
  v1.use("/lookups", lookupsRouter);
  v1.use("/students", studentsRouter);
  v1.use("/committee", committeeRouter);
  v1.use(assessmentsRouter);
  v1.use(partnersRouter);
  v1.use(reportsRouter);
  v1.use(miscRouter);
  v1.use(adminToolsRouter);
  app.use("/api/v1", v1);

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);
  return app;
}
