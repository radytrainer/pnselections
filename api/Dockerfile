# Build context: repository root (needs api/ and db/).
#   docker build -f api/Dockerfile -t scholarship-api .

FROM node:22-alpine AS build
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    PORT=4000 \
    MIGRATIONS_DIR=/app/db/migrations \
    STORAGE_LOCAL_DIR=/data/storage
WORKDIR /app/api
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
COPY api/package.json ./
COPY db /app/db
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
