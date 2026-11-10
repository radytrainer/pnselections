import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",

  // In Docker/AWS the reverse proxy (Caddy / ALB) routes /api/* straight to
  // the Node.js API service and these rewrites are never reached. They exist
  // for plain `npm run dev`, where the API runs separately on :4000.
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
