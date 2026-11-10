function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(optional("PORT", "4000")),
  nodeEnv: optional("NODE_ENV", "development"),
  get isProduction() {
    return this.nodeEnv === "production";
  },

  /** Login role used by the API at runtime (no table privileges of its own — see 0000_platform_bootstrap.sql). */
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  databaseSsl: optional("DATABASE_SSL", "false") === "true",

  redisUrl: optional("REDIS_URL", "redis://localhost:6379"),

  firebase: {
    get projectId() {
      return required("FIREBASE_ADMIN_PROJECT_ID");
    },
    get clientEmail() {
      return required("FIREBASE_ADMIN_CLIENT_EMAIL");
    },
    get privateKey() {
      // Accept the key with literal "\n" sequences (as stored in .env files).
      return required("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
    },
  },

  storage: {
    /** "local" (filesystem / Docker volume) or "s3" (AWS S3 or any S3-compatible service). */
    driver: optional("STORAGE_DRIVER", "local") as "local" | "s3",
    localDir: optional("STORAGE_LOCAL_DIR", "./storage-data"),
    s3Bucket: process.env.S3_BUCKET ?? "",
    s3Region: optional("S3_REGION", optional("AWS_REGION", "ap-southeast-1")),
    /** Only for S3-compatible services; leave empty for AWS S3. */
    s3Endpoint: process.env.S3_ENDPOINT || undefined,
    s3ForcePathStyle: optional("S3_FORCE_PATH_STYLE", "false") === "true",
  },

  /** Requests per minute per client IP for /api (0 disables). */
  rateLimitPerMinute: Number(optional("RATE_LIMIT_PER_MINUTE", "1200")),
  /** Comma-separated list of allowed CORS origins; empty = same-origin only (the default reverse-proxy setup). */
  corsOrigins: optional("CORS_ORIGINS", "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** Number of reverse proxies in front of the API (Caddy, ALB) so req.ip is the real client. */
  trustProxy: Number(optional("TRUST_PROXY", "1")),
};
