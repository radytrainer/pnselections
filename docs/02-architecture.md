# System Architecture

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph Client["Browser / Field Device"]
        WebApp["Next.js 15 App (React, TS, Tailwind, ShadCN)"]
    end

    subgraph Vercel["Vercel (Hosting + Edge)"]
        SSR["Next.js Server Components / Route Handlers"]
        EdgeMW["Edge Middleware (session check, role gating)"]
    end

    subgraph FirebaseCloud["Firebase"]
        FBAuth["Firebase Authentication (Google + Email/Password)"]
    end

    subgraph SupabaseCloud["Supabase"]
        PG["PostgreSQL (students, exams, interviews, visits, committee, NGOs, schools, audit_logs)"]
        Storage["Supabase Storage (documents, photos, reports)"]
        EdgeFn["Supabase Edge Functions (auth-bridge, report-export, ai-proxy)"]
        Realtime["Supabase Realtime (live dashboard updates)"]
    end

    subgraph AnthropicCloud["Anthropic"]
        Claude["Claude API (summaries, reports, recommendations, NL-to-SQL)"]
    end

    subgraph StaticAssets["Static Assets"]
        GeoJSON["Cambodia Province GeoJSON"]
    end

    WebApp -->|Login| FBAuth
    FBAuth -->|ID Token| EdgeFn
    EdgeFn -->|Verify token, issue Supabase JWT w/ role claims| WebApp
    WebApp -->|Supabase JWT| SSR
    SSR -->|PostgREST / RLS-scoped queries| PG
    SSR -->|Signed URLs| Storage
    WebApp -->|Leaflet render| GeoJSON
    SSR -->|Server-side only, never client| Claude
    EdgeFn -->|Generate SQL, execute read-only| PG
    PG -->|Change events| Realtime
    Realtime -->|Live KPI updates| WebApp
    EdgeMW -.->|Protects routes| SSR
```

## 2. Component Responsibilities

| Component | Responsibility |
|---|---|
| **Next.js App (Vercel)** | UI rendering, server actions/route handlers, RBAC route gating, calls to Supabase via server-side client (service operations) and client SDK (read-mostly with RLS) |
| **Firebase Authentication** | Identity provider — Google OAuth + Email/Password, issues Firebase ID tokens |
| **Auth Bridge (Supabase Edge Function)** | Verifies Firebase ID token (Firebase Admin SDK), looks up the user's role(s) and NGO scope in Postgres, mints a Supabase-compatible JWT with custom claims (`role`, `ngo_id`, `firebase_uid`) signed with the Supabase JWT secret |
| **Supabase Postgres** | System of record — all relational data, RLS policies enforce row visibility per role/claims |
| **Supabase Storage** | Student documents, ID cards, transcripts, certificates, home visit photos/reports — private buckets, signed URL access only |
| **Supabase Edge Functions** | Server-side jobs: auth bridge, report generation (PDF/Excel), AI proxy (keeps the Claude API key off the client), scheduled aggregation refresh |
| **Claude API** | All 4 AI features — always invoked server-side (Edge Function or Next.js Route Handler), never directly from the browser |
| **React Leaflet + GeoJSON** | Client-side Cambodia province choropleth map; province polygons from static GeoJSON, student metrics joined from Supabase at render time |
| **Vercel** | Hosting, CI/CD, edge middleware for auth/role gating, environment/secret management |

## 3. Why a Firebase → Supabase Auth Bridge

The stack specifies Firebase Authentication for login but Supabase Postgres/RLS for authorization. Supabase RLS natively expects a JWT it can verify (so `auth.jwt()` works in policies). Rather than running a custom token-minting service, this design uses **Supabase Third-Party Auth**, which lets a Supabase project trust and directly verify Firebase ID tokens (via Firebase's public JWKS) with no shared-secret signing step:

1. Client signs in with Firebase (Google or Email/Password) → receives a Firebase ID token.
2. The Supabase project is configured (Dashboard → Authentication → Third-Party Auth) to trust the Firebase project as an external JWT issuer.
3. Role and NGO scope are carried as **Firebase custom claims** (`role`, `ngo_id`), set server-side via the Firebase Admin SDK (`setCustomUserClaims`) whenever an admin assigns/changes a user's role in `user_roles`/`user_ngo_link`. Firebase merges custom claims into the ID token payload automatically on the next token mint/refresh.
4. The client passes its current Firebase ID token to the Supabase client via the `accessToken` callback (`@supabase/supabase-js` v2's third-party-auth option) — no separate Supabase session/login step, no custom JWT minting.
5. RLS policies read `auth.jwt() ->> 'role'` and `auth.jwt() ->> 'ngo_id'` directly from the verified Firebase token's claims. Because the token's `sub` is the Firebase UID (not our internal `users.id`), any trigger/policy that needs our internal user id resolves it via `select id from users where firebase_uid = auth.jwt()->>'sub'` rather than casting `sub` to a uuid.
6. Server-side (Server Components/Route Handlers) needs the same ID token: the client forwards it to `POST /api/auth/session` on login and on every token refresh (Firebase ID tokens expire hourly); that route verifies it with the Firebase Admin SDK and stores it in an HTTP-only cookie, which the server Supabase client reads for its own `accessToken` callback.

This removes the `auth-bridge` Edge Function and the dependency on a project JWT signing secret entirely. Further detail in [09-security.md](09-security.md) §2.

## 4. Key Data Flows

### 4.1 Login Flow
```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js App
    participant FB as Firebase Auth
    participant EF as Supabase Edge Fn (auth-bridge)
    participant DB as Supabase Postgres

    U->>App: Click "Sign in with Google" / submit email+password
    App->>FB: signInWithPopup / signInWithEmailAndPassword
    FB-->>App: Firebase ID Token
    App->>EF: POST /auth-bridge {idToken}
    EF->>FB: Verify ID token (Admin SDK)
    EF->>DB: SELECT role, ngo_id FROM users/user_roles WHERE firebase_uid = ?
    DB-->>EF: role, ngo_id
    EF-->>App: Supabase JWT (custom claims: role, ngo_id)
    App->>App: Store session, redirect to role-based dashboard
```

### 4.2 AI Data Assistant Flow
```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js Route Handler
    participant Claude as Claude API
    participant DB as Supabase Postgres (read replica/role-limited)

    U->>App: "How many female students were selected from Siem Reap in 2026?"
    App->>App: Attach schema context + role/claims for scoping
    App->>Claude: Generate SQL (system prompt: schema, read-only, parameterized)
    Claude-->>App: Generated SQL (SELECT-only)
    App->>App: Validate query (deny-list: INSERT/UPDATE/DELETE/DDL, enforce RLS-equivalent WHERE)
    App->>DB: Execute via restricted read-only role
    DB-->>App: Result rows
    App->>Claude: Summarize result in natural language (optional)
    App-->>U: Answer + underlying SQL + table view
```

### 4.3 File Upload Flow (Home Visit Photos)
```mermaid
sequenceDiagram
    participant U as Field User (mobile)
    participant App as Next.js App
    participant Storage as Supabase Storage
    participant DB as Supabase Postgres

    U->>App: Select/capture photo in Home Visit form
    App->>App: Client-side resize/compress
    App->>Storage: Upload to private bucket (path: cycle/{cycle_id}/students/{student_id}/visits/{visit_id}/)
    Storage-->>App: Storage object path
    App->>DB: INSERT INTO home_visit_media (home_visit_id, media_type, file_path)
    DB-->>App: ack
    Note over App,Storage: Display via short-lived signed URL only, never public bucket
```

## 5. Multi-Year Cycle Handling

Every transactional table (`students`, `exam_results`, `interviews`, `home_visits`, `committee_decisions`) carries a `cycle_id` foreign key to `selection_cycles`. Dashboard and reporting queries always filter/group by `cycle_id`, enabling:
- Year-over-year comparison without data migration
- A student re-applying in a later cycle to have an independent record per cycle, linked by a stable `student_global_id` for longitudinal tracking
- Cycle-scoped RLS where needed (e.g., archived cycles becoming read-only for non-admins)

## 6. Environments

| Environment | Vercel project | Supabase project | Firebase project |
|---|---|---|---|
| Production | `scholarship-tracker` | `sst-prod` | `sst-prod` |
| Staging | `scholarship-tracker-staging` | `sst-staging` | `sst-staging` |
| Preview (per PR) | Vercel preview deployments | `sst-staging` (shared, schema-isolated by branch where possible) | `sst-staging` |
