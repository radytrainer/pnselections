# Next.js 15 Project Structure

```
scholarship-tracker/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx                 # invited-user activation
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                         # sidebar + role-aware nav
│   │   ├── dashboard/
│   │   │   └── page.tsx                       # Executive Dashboard
│   │   ├── map/
│   │   │   ├── page.tsx                       # Cambodia GIS map
│   │   │   └── [provinceId]/page.tsx          # Province detail/analytics
│   │   ├── students/
│   │   │   ├── page.tsx                       # TanStack Table list + filters
│   │   │   ├── new/page.tsx
│   │   │   └── [studentId]/
│   │   │       ├── page.tsx                   # Profile overview
│   │   │       ├── exam/page.tsx
│   │   │       ├── interview/page.tsx
│   │   │       ├── home-visit/page.tsx
│   │   │       ├── documents/page.tsx
│   │   │       └── edit/page.tsx
│   │   ├── committee/
│   │   │   ├── queue/page.tsx
│   │   │   └── [studentId]/page.tsx           # Dossier + decision form
│   │   ├── ngos/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [ngoId]/page.tsx
│   │   ├── schools/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [schoolId]/page.tsx
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   ├── ai-assistant/
│   │   │   └── page.tsx                       # NL data assistant chat UI
│   │   └── admin/
│   │       ├── users/page.tsx
│   │       └── cycles/page.tsx
│   ├── api/
│   │   ├── auth/bridge/route.ts
│   │   ├── students/route.ts
│   │   ├── students/[id]/route.ts
│   │   ├── students/[id]/documents/route.ts
│   │   ├── students/import/route.ts
│   │   ├── exams/route.ts
│   │   ├── interviews/route.ts
│   │   ├── home-visits/route.ts
│   │   ├── home-visits/[id]/generate-report/route.ts
│   │   ├── committee/queue/route.ts
│   │   ├── committee/[studentId]/decision/route.ts
│   │   ├── ngos/route.ts
│   │   ├── schools/route.ts
│   │   ├── dashboard/summary/route.ts
│   │   ├── dashboard/charts/route.ts
│   │   ├── map/provinces/route.ts
│   │   ├── reports/generate/route.ts
│   │   └── ai/
│   │       ├── student-summary/[studentId]/route.ts
│   │       ├── home-visit-report/[visitId]/route.ts
│   │       ├── recommendation/[studentId]/route.ts
│   │       └── ask/route.ts
│   ├── layout.tsx
│   ├── globals.css
│   └── middleware.ts                          # session + RBAC route gating
│
├── components/
│   ├── ui/                                    # ShadCN generated primitives (button, dialog, table, ...)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── RoleGate.tsx                       # conditionally render by role
│   ├── charts/
│   │   ├── ProvinceBarChart.tsx
│   │   ├── GenderDonutChart.tsx
│   │   ├── SelectionFunnelChart.tsx
│   │   ├── YearComparisonChart.tsx
│   │   └── NgoContributionChart.tsx
│   ├── map/
│   │   ├── CambodiaMap.tsx                    # React Leaflet wrapper
│   │   ├── ProvinceLayer.tsx                  # choropleth + tooltip
│   │   └── ProvinceTooltip.tsx
│   ├── tables/
│   │   ├── StudentsTable.tsx                  # TanStack Table instance
│   │   ├── DataTableToolbar.tsx
│   │   └── columns/                           # column defs per table
│   └── forms/
│       ├── StudentForm.tsx
│       ├── ExamScoreForm.tsx
│       ├── InterviewForm.tsx
│       ├── HomeVisitForm.tsx
│       └── CommitteeDecisionForm.tsx
│
├── features/                                  # feature-sliced business logic (UI + hooks + actions per domain)
│   ├── students/
│   │   ├── actions.ts                         # server actions
│   │   ├── queries.ts                         # Supabase queries
│   │   └── schema.ts                          # zod validation schema
│   ├── exams/
│   ├── interviews/
│   ├── home-visits/
│   ├── committee/
│   ├── ngos/
│   ├── schools/
│   ├── dashboard/
│   ├── map/
│   ├── reports/
│   └── ai/
│
├── hooks/
│   ├── useAuth.ts
│   ├── useRole.ts
│   ├── useSupabaseQuery.ts
│   └── useDebouncedValue.ts
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                          # browser client
│   │   ├── server.ts                          # server component / route handler client
│   │   └── admin.ts                           # service-role client (server-only, never imported client-side)
│   ├── firebase/
│   │   ├── client.ts
│   │   └── admin.ts                           # Firebase Admin SDK (server-only)
│   ├── claude/
│   │   └── client.ts                          # Anthropic SDK wrapper (server-only)
│   ├── utils.ts
│   ├── constants.ts                            # roles, statuses, enums mirrored from DB checks
│   └── rbac.ts                                 # role → permission matrix helpers
│
├── services/
│   ├── studentService.ts
│   ├── examService.ts
│   ├── interviewService.ts
│   ├── homeVisitService.ts
│   ├── committeeService.ts
│   ├── ngoService.ts
│   ├── schoolService.ts
│   ├── dashboardService.ts
│   ├── mapService.ts
│   ├── reportService.ts
│   └── aiService.ts
│
├── types/
│   ├── database.types.ts                       # generated via `supabase gen types typescript`
│   ├── student.ts
│   ├── exam.ts
│   ├── interview.ts
│   ├── homeVisit.ts
│   ├── committee.ts
│   ├── ngo.ts
│   ├── school.ts
│   └── ai.ts
│
├── supabase/
│   ├── migrations/                             # versioned SQL migrations (source of truth = docs/04-schema.sql split into steps)
│   ├── functions/
│   │   ├── auth-bridge/index.ts
│   │   ├── report-export/index.ts
│   │   └── ai-proxy/index.ts
│   ├── seed.sql
│   └── config.toml
│
├── firebase/
│   ├── firebase.json
│   └── firestore.rules                         # not used for data, present only if Firebase project requires it
│
├── public/
│   └── geo/
│       └── cambodia-provinces.geojson
│
├── middleware.ts                                # re-exported from app/middleware.ts (Next.js root requirement)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

## Notes

- **`features/` vs `services/`**: `features/*` holds UI-adjacent logic (Server Actions, Zod schemas, React Query/SWR hooks) scoped to one domain; `services/*` holds pure data-access functions callable from both Route Handlers and Server Actions, keeping a single implementation of each query.
- **`lib/supabase/admin.ts`** wraps the Supabase **service role** key and must only ever be imported from server-only files (Route Handlers, Edge Functions) — never from a Client Component, enforced via `import "server-only"` at the top of the file.
- **`types/database.types.ts`** is regenerated via `supabase gen types typescript --project-id <id> > types/database.types.ts` whenever the schema changes, and is the single source of truth for Supabase row/insert/update types used across `services/`.
- Cambodia province GeoJSON lives in `public/geo/` as a static asset; `geojson_property_id` in the `provinces` table is the join key used by `components/map/ProvinceLayer.tsx`.
