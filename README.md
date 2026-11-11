# Scholarship Selection Tracker System

A platform for an NGO education partnership to recruit, assess, interview,
visit, evaluate and select scholarship students across all 25 provinces of
Cambodia.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn/ui, React Hook Form, TanStack Table, Recharts, React Leaflet |
| Backend | Node.js 22 REST API (Express 5) in [`api/`](api/) |
| Database | PostgreSQL 17 with row-level security; schema in [`db/migrations/`](db/migrations/) |
| Cache / realtime | Redis 7: live committee votes (pub/sub → Server-Sent Events), lookup cache, rate limiting |
| File storage | Docker volume, or Amazon S3 (`STORAGE_DRIVER=s3`) |
| Auth | Firebase Authentication (Email/Password); the API verifies ID tokens |
| Runtime | Docker Compose, with Caddy as reverse proxy and automatic HTTPS |
| Hosting | AWS EC2 (see [docs/10-deployment.md](docs/10-deployment.md)) |

```
browser ──HTTPS──► caddy ──/api/*──► api (Express) ──► postgres (RLS)
                     │                    ├──────────► redis
                     └──────other──► web (Next.js)     └──► storage volume / S3
```

## Quick start (Docker)

Requires Docker with the compose plugin.

```bash
./scripts/init-env.sh          # creates .env with generated passwords
# edit .env: NEXT_PUBLIC_FIREBASE_* and FIREBASE_ADMIN_* values
./scripts/deploy.sh            # build, migrate, start
```

Open http://localhost. Users are created by a Super Admin under
**Admin → Users**. To bootstrap the very first Super Admin, create the account
in Firebase, insert its `users`/`user_roles` rows, and set the custom claim
`app_role=super_admin` once with the Firebase Admin SDK.

Useful commands:

```bash
docker compose ps
docker compose logs -f api
docker compose exec postgres psql -U postgres scholarship
./scripts/backup-db.sh
```

## Field Mode (offline)

Home-visit, exam and interview teams can work without internet:

1. **While online:** sign in, open **Field Mode (Offline)** in the sidebar, and press **Download for offline**. This saves this cycle's students, the form questions and the app itself on the device.
2. **In the field:** open Field Mode and pick a student. The **social form**, **exam** and **interview** forms, plus eliminate/undo elimination, save to the device.
3. **Back online:** changes sync automatically. A chip in the top bar shows how many are waiting, and any that the server rejected can be retried or discarded there.

How it works:
- `lib/offline/`: the IndexedDB cache, the outbox and the sync engine.
- `/api/v1/offline/bundle`: the download endpoint.
- `api/src/idempotency.ts`: makes retries safe, so a change sent twice is saved once.
- Permissions are still checked by the server when changes sync.
- Committee votes and decisions, user admin and partner editing need a connection.
- Offline data is wiped from the device on sign-out.

## Local development (hot reload)

```bash
docker compose up -d postgres redis          # databases only (ports bound to 127.0.0.1)
cp api/.env.example api/.env                 # match passwords from .env
npm --prefix api install
npm run db:migrate                           # apply db/migrations + seed
npm run api:dev                              # API on http://localhost:4000
npm run dev                                  # Next.js on http://localhost:3000 (proxies /api → :4000)
```

The web app needs only `NEXT_PUBLIC_FIREBASE_*` in `.env.local`. All data
access goes through the API.

## Project layout

| Path | Contents |
|---|---|
| `app/`, `components/`, `features/`, `hooks/`, `lib/` | Next.js frontend |
| `services/` | Frontend data layer; each function calls the REST API via `lib/api/client.ts` |
| `api/src/` | REST API: `routes/` (one file per area), `db.ts` (RLS-scoped transactions), `auth.ts`, `storage.ts`, `redis.ts` |
| `api/src/scripts/` | `migrate.ts` (schema migrator), `migrate-storage.ts` (one-time Supabase Storage copy) |
| `db/migrations/` | Numbered SQL migrations; `0000_platform_bootstrap.sql` provides the `auth.jwt()` RLS context |
| `db/seed.sql` | Provinces, roles and the initial cycle (idempotent) |
| `deploy/Caddyfile` | Reverse proxy / TLS config |
| `scripts/` | `remote-deploy.sh` (deploy to AWS from your computer), `init-env.sh`, `setup-server.sh`, `deploy.sh`, `backup-db.sh`, `restore-db.sh`, `import-from-supabase.sh` |

## Moving off Supabase

Existing production data and files are copied with
`./scripts/import-from-supabase.sh`. See
[docs/10-deployment.md §2.3](docs/10-deployment.md#23-moving-existing-data-from-supabase-one-time).

## Documents

| # | Document | Contents |
|---|---|---|
| 1 | [docs/01-prd.md](docs/01-prd.md) | Product requirements |
| 2 | [docs/02-architecture.md](docs/02-architecture.md) | Original architecture design |
| 3 | [docs/03-erd.md](docs/03-erd.md) | ERD |
| 4 | [docs/04-schema.sql](docs/04-schema.sql) | Original full DDL (the source of truth is now `db/migrations/`) |
| 5 | [docs/05-api-design.md](docs/05-api-design.md) | Original API design |
| 6 | [docs/07-ui-pages.md](docs/07-ui-pages.md) | UI/UX page specifications |
| 7 | [docs/09-security.md](docs/09-security.md) | Auth flow, RBAC matrix, audit logging |
| 8 | [docs/10-deployment.md](docs/10-deployment.md) | **Docker / AWS deployment runbook** |
| 9 | [docs/11-roadmap.md](docs/11-roadmap.md) | Roadmap |

Documents 1–7 predate the move off Supabase and Vercel. Their business rules
and RBAC still apply. Where they mention Supabase PostgREST, Storage,
Realtime or Vercel, read the API, the storage volume/S3, Redis SSE and Docker
on AWS instead.
