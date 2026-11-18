# Graph Report - selection tracker  (2026-11-18)

## Corpus Check
- 328 files · ~180,651 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 6, .example 2, .lock 1)

## Summary
- 2386 nodes · 7772 edges · 172 communities (100 shown, 72 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 84 edges (avg confidence: 0.85)
- Token cost: 114,568 input · 0 output

## Community Hubs (Navigation)
- Offline Sync & API Client
- Initial DB Schema
- Schema Reference Doc
- Form Inputs & Selects
- Exam Scoring & ZipGrade
- Dialogs & Exam Papers
- Selection Process Dashboard
- Student Import & Lookups
- Social Form Scoring
- Admin Tables & Cycles
- Interview Form & Pass Rule
- Committee Review Services
- Finalist Reports
- Cards & Committee Queue
- Exam Candidates Tab
- NGO & School Partners
- Auth & App Layout
- API SQL Helpers
- Committee Presentation
- Student Visit Report
- Student Constants & Service
- Student Detail & Field Mode
- Student Cards & Badges
- Written Exams API
- Dropdown Menus
- Social Form Field Entry
- API Server Bootstrap
- Students & Admin Tools API
- API Errors & Lookups
- Buttons & User Admin
- Cambodia Map
- Exam Results Tab
- Frontend Dev Dependencies
- Frontend Dependencies
- API Dev Dependencies
- Firebase Auth Middleware
- Committee & Partner Routes
- Main Dashboard
- shadcn Config
- File Storage Backends
- Exam Center Planning
- Audit Log Viewer
- Interview Question Admin
- Students List & Interview Centers
- Exam Pass Rules
- compilerOptions Group
- files Group
- dashboardService Group
- dependencies Group
- lucide-react Group
- CambodiaMap Group
- environment Group
- x-api-env Group
- Scholarship Selection Tracker  Group
- ngoService Group
- resultsExport Group
- 0037_dynamic_interview_questio Group
- 0052_written_exams Group
- users Group
- compilerOptions Group 2
- SocialForm Group
- RBAC defense in depth (RLS, Ro Group
- schoolService Group
- services Group
- students table Group
- AI Data Assistant (NL to SQL) Group
- backup/page Group
- NgoYearlyChart Group
- CommitteeQueueCard Group
- selection_cycles Group
- migrate Group
- Firebase to Supabase Third-Par Group
- ExamEntry Group
- audit_logs Group
- interview_centers Group
- args Group
- api Group
- postgres Group
- selection_cycles table Group
- migrate Group 2
- scripts Group
- migrate-storage Group
- 0053_exam_planning Group
- caddy Group
- redis Group
- Home Visit Entry mobile-first  Group
- eslint.config Group
- Cambodia provinces GeoJSON (ge Group
- audit_logs (polymorphic) Group
- scripts Group 2
- committee_ratings Group
- healthcheck Group
- remote-deploy Group
- social_assessments Group
- exam_score_overrides Group
- sw Group
- exam_key_versions Group
- Six-Stage Selection Pipeline Group
- clsx Group
- server-install Group
- overrides Group
- Server-side-only Claude API ke Group
- Reports API (enqueue + poll) Group
- backup-db Group
- deploy Group
- import-from-supabase Group
- init-env Group
- restore-db Group
- Executive Dashboard KPIs and c Group
- Data Encryption (TLS, at-rest, Group
- Backups (pg_dump, S3, EBS snap Group
- next-themes Group
- postcss.config Group
- setup-server Group
- Production / Staging / Preview Group
- middleware.ts session + RBAC r Group
- Server-only service-role clien Group
- /api/health + CloudWatch monit Group

## God Nodes (most connected - your core abstractions)
1. `cn()` - 206 edges
2. `Button()` - 131 edges
3. `react` - 99 edges
4. `lucide-react` - 80 edges
5. `Input()` - 70 edges
6. `sonner` - 67 edges
7. `Skeleton()` - 65 edges
8. `Card()` - 58 edges
9. `CardContent()` - 58 edges
10. `SelectContent()` - 58 edges

## Surprising Connections (you probably didn't know these)
- `Two API layers: PostgREST direct + Route Handlers` --semantically_similar_to--> `Express 5 REST API (api/)`  [AMBIGUOUS] [semantically similar]
  docs/05-api-design.md → README.md
- `Redis pub/sub to SSE live committee votes` --semantically_similar_to--> `Original High-Level Architecture (Vercel/Supabase/Firebase)`  [INFERRED] [semantically similar]
  README.md → docs/02-architecture.md
- `API idempotency (api/src/idempotency.ts)` --semantically_similar_to--> `API Conventions (auth, pagination, errors, idempotency, rate limiting)`  [INFERRED] [semantically similar]
  README.md → docs/05-api-design.md
- `chartLoading()` --calls--> `Skeleton()`  [EXTRACTED]
  app/(dashboard)/dashboard/page.tsx → components/ui/skeleton.tsx
- `PopoverHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/popover.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Selection pipeline stage modules and tables** — docs_01_prd_selection_pipeline, docs_03_erd_exam_results, docs_03_erd_interviews, docs_03_erd_home_visits, docs_03_erd_committee_decisions, docs_03_erd_selection_cycles [INFERRED 0.85]
- **AI Data Assistant layered guardrails** — docs_08_ai_integration_nl_to_sql_assistant, docs_08_ai_integration_sql_static_validation, docs_08_ai_integration_ai_readonly_role, docs_08_ai_integration_cost_reliability_controls [EXTRACTED 1.00]
- **RBAC defense-in-depth enforcement layers** — docs_09_security_rbac_defense_in_depth, readme_postgres_rls, docs_10_deployment_api_rls_claims, docs_06_nextjs_structure_rolegate, docs_06_nextjs_structure_lib_rbac [INFERRED 0.85]

## Communities (172 total, 72 thin omitted)

### Community 0 - "Offline Sync & API Client"
Cohesion: 0.05
Nodes (77): handleDownload(), OfflinePage(), Logo(), handleSignOut(), OfflineIndicator(), syncNow(), OfflineSyncAgent(), run() (+69 more)

### Community 1 - "Initial DB Schema"
Cohesion: 0.06
Nodes (79): ai_query_logs, ai_summaries, audit_logs, committee_decisions, committee_notes, communes, districts, exam_results (+71 more)

### Community 2 - "Schema Reference Doc"
Cohesion: 0.06
Nodes (77): ai_query_logs, ai_summaries, audit_logs, committee_decisions, committee_notes, communes, districts, exam_results (+69 more)

### Community 3 - "Form Inputs & Selects"
Cohesion: 0.10
Nodes (53): HIGHLIGHTS, LoginPage(), goAfterLogin(), onSubmit(), loginSchema, LoginValues, NgosPage(), SchoolsPage() (+45 more)

### Community 4 - "Exam Scoring & ZipGrade"
Cohesion: 0.05
Nodes (68): DocxGroup, DocxRow, downloadExamListDocx(), fmtDate(), GENDER, loadLogo(), downloadWord(), exportList() (+60 more)

### Community 5 - "Dialogs & Exam Papers"
Cohesion: 0.10
Nodes (52): AdminUsersPage(), StudentDetailDrawer(), AnalysisTab(), save(), Meta, TabProps, AddDialog(), AssignDialog() (+44 more)

### Community 6 - "Selection Process Dashboard"
Cohesion: 0.10
Nodes (54): FunnelStep, Issue, LoadingState(), Phase, PHASE_TITLES, phaseOfStep(), PhaseTab, PhaseTabs() (+46 more)

### Community 7 - "Student Import & Lookups"
Cohesion: 0.06
Nodes (51): NewNgoPage(), handleSubmit(), NewStudentPage(), handleSubmit(), AvatarUploadField(), handlePhotoSelect(), HEADER_ALIASES, ImportResult (+43 more)

### Community 8 - "Social Form Scoring"
Cohesion: 0.09
Nodes (52): ASSET_POINTS, DEFAULT_VALUES, STEP_FIELDS, STEPS, ACADEMIC_OPTS, ASSET_OPTS, ASSET_RANK_LABELS, DEBT_OPTS (+44 more)

### Community 9 - "Admin Tables & Cycles"
Cohesion: 0.12
Nodes (38): AuditLogsPage(), DialogState, formatDate(), FormState, SelectionCyclesPage(), handleActivate(), handleSave(), STATUS_STYLES (+30 more)

### Community 10 - "Interview Form & Pass Rule"
Cohesion: 0.10
Nodes (38): InterviewEntryPage(), InterviewEntry(), handleSubmit(), InterviewForm(), ScoreSummary(), InterviewPassRuleCard(), save(), switchMode() (+30 more)

### Community 11 - "Committee Review Services"
Cohesion: 0.07
Nodes (35): handleApproval(), DECISION_BANNER, GENDER_LABELS, POOR_LEVELS, PoorLevel, CommitteeRatingPanel(), handleRate(), CommitteeRatingRow (+27 more)

### Community 12 - "Finalist Reports"
Cohesion: 0.11
Nodes (38): handleDecision(), AgeValue(), buildExportSheet(), EXPORT_COLUMN_WIDTHS, EXPORT_HEADER, exportFinalistsToExcel(), FinalistPage(), finalistSearchFields() (+30 more)

### Community 13 - "Cards & Committee Queue"
Cohesion: 0.18
Nodes (30): AccountPage(), handleProfileSubmit(), OptionCard(), CommitteeQueuePage(), StoredFilterState, CommitteeDossierPage(), SchoolDetailPage(), Funnel() (+22 more)

### Community 14 - "Exam Candidates Tab"
Cohesion: 0.08
Nodes (36): Tab, TABS, CandidatesTab(), DetailDraft, DetailFields(), downloadCandidateTemplate(), Filter, FILTERS (+28 more)

### Community 15 - "NGO & School Partners"
Cohesion: 0.17
Nodes (26): NgoDetailPage(), ImageUploadField(), RoleGate(), getNgoColumns(), StatPill(), getSchoolColumns(), StatPill(), NgosTable() (+18 more)

### Community 16 - "Auth & App Layout"
Cohesion: 0.11
Nodes (22): DashboardLayout(), ExamListsPage(), fmtDate(), GENDER, AuthSync(), LogoMark(), activeHref(), CONFIG_ITEMS (+14 more)

### Community 17 - "API SQL Helpers"
Cohesion: 0.10
Nodes (30): Db, withClaims(), assignRole(), perTable(), applyNextStatus(), assessmentsRouter, compareRule(), cycleInterviewTotals() (+22 more)

### Community 18 - "Committee Presentation"
Cohesion: 0.10
Nodes (30): buildReportModel(), Gauge(), Located, NEED, NeedPill(), OverviewSlide(), PresentationStudent, PresentationView() (+22 more)

### Community 19 - "Student Visit Report"
Cohesion: 0.10
Nodes (28): Data, Field(), FindingList(), FindingsTable(), GENDER, Photo, PhotoSection(), add() (+20 more)

### Community 20 - "Student Constants & Service"
Cohesion: 0.07
Nodes (26): DECIDED_STATUSES, EXAM_FAIL_REASON_PREFIX, ID_TOKEN_COOKIE, INTERVIEW_FAIL_REASON, OUTREACH_STATUS_LABELS, OUTREACH_STATUSES, OutreachStatus, POOR_LEVEL_BADGE_CLASSES (+18 more)

### Community 21 - "Student Detail & Field Mode"
Cohesion: 0.14
Nodes (24): ExamsPage(), toggleLock(), FieldModePage(), provinceOf(), CATEGORY_ICONS, Field(), PIPELINE_STAGES, PipelineStepper() (+16 more)

### Community 22 - "Student Cards & Badges"
Cohesion: 0.19
Nodes (24): FinalistTable(), handleSendToCommittee(), NavLink(), Detail(), StudentCard(), Empty(), GENDER_LABEL, getStudentColumns() (+16 more)

### Community 23 - "Written Exams API"
Cohesion: 0.09
Nodes (21): HttpError, notFound(), loadPassRule(), keyFromParams(), duplicateError(), assertUnlocked(), canonical(), centerCycle() (+13 more)

### Community 24 - "Dropdown Menus"
Cohesion: 0.11
Nodes (23): InfoItem(), ZipgradeExportMenu(), AvatarBadge(), AvatarGroup(), AvatarGroupCount(), CardAction(), CardFooter(), DropdownMenuCheckboxItem() (+15 more)

### Community 25 - "Social Form Field Entry"
Cohesion: 0.16
Nodes (21): FieldPage(), Page(), FieldPage(), Page(), EditStudentPage(), handleSubmit(), SocialFormEntryPage(), StudentReportPage() (+13 more)

### Community 26 - "API Server Bootstrap"
Cohesion: 0.15
Nodes (18): createApp(), requireRole(), config, Claims, pool, errorHandler(), idempotency(), main() (+10 more)

### Community 27 - "Students & Admin Tools API"
Cohesion: 0.11
Nodes (19): adminToolsRouter, auditFilters(), requestedTables(), SKIP_TABLES, body, DOCUMENTS, DUPLICATE_FIELDS, DUPLICATE_NUMERIC_FIELDS (+11 more)

### Community 28 - "API Errors & Lookups"
Cohesion: 0.13
Nodes (20): badRequest(), forbidden(), PG_STATUS, PgError, CACHE_KEYS, cached(), invalidate(), requireRole() (+12 more)

### Community 29 - "Buttons & User Admin"
Cohesion: 0.14
Nodes (17): AdminUser, NewSchoolPage(), handleSubmit(), UserFormValues, buttonVariants, createUserSchema, CreateUserValues, updateUserSchema (+9 more)

### Community 30 - "Cambodia Map"
Cohesion: 0.14
Nodes (17): DashboardError(), CambodiaMap, GENDER_FILTER_LABELS, GENDER_FILTER_OPTIONS, LAYER_FILTER_LABELS, LAYER_FILTER_OPTIONS, MapPage(), MapGenderFilter (+9 more)

### Community 31 - "Exam Results Tab"
Cohesion: 0.12
Nodes (24): exportResultsDocx(), exportResultsXlsx(), ResultsPrint(), Filter, GENDER_LABEL, Mark, marksFrom(), Meta (+16 more)

### Community 32 - "Frontend Dev Dependencies"
Cohesion: 0.11
Nodes (24): devDependencies, eslint@^9, eslint-config-next@^15.5.19, playwright@^1.61.0, tailwindcss@^4, @tailwindcss/postcss@^4, @types/leaflet@^1.9.21, @types/node@^20 (+16 more)

### Community 33 - "Frontend Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, @base-ui/react@^1.6.0, class-variance-authority@^0.7.1, date-fns@^4.4.0, firebase@^12.15.0, @hookform/resolvers@^5.4.0, lucide-react@^1.21.0, next@^15.5.19 (+17 more)

### Community 34 - "API Dev Dependencies"
Cohesion: 0.11
Nodes (22): description, devDependencies, tsx@^4.20.0, @types/cookie-parser@^1.4.10, @types/express@^5.0.6, @types/multer@^2.0.0, @types/node@^22.15.0, @types/pg@^8.23.1 (+14 more)

### Community 35 - "Firebase Auth Middleware"
Cohesion: 0.14
Nodes (20): AuthUser, Express, Request, extractToken(), firebaseApp(), firebaseAuth(), ID_TOKEN_COOKIE, requireAuth() (+12 more)

### Community 36 - "Committee & Partner Routes"
Cohesion: 0.17
Nodes (16): asUser(), publish(), committeeRouter, decisionBody, DOCUMENTS, PROVINCE, RATINGS, SCHOOL (+8 more)

### Community 37 - "Main Dashboard"
Cohesion: 0.16
Nodes (19): applyGender(), chartLoading(), DashboardPage(), DECISIONS, DecisionStatus, fmt(), GenderFilter, GENDERS (+11 more)

### Community 38 - "shadcn Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 39 - "File Storage Backends"
Cohesion: 0.14
Nodes (7): assertSafeKey(), CONTENT_TYPES, contentTypeFor(), LocalStorage, ObjectStorage, S3Storage, StoredObject

### Community 40 - "Exam Center Planning"
Cohesion: 0.18
Nodes (18): CenterEditor(), centerFacts(), Field(), NewCenterDialog(), submit(), PlanningTab(), Province, RoomDraft (+10 more)

### Community 41 - "Audit Log Viewer"
Cohesion: 0.16
Nodes (18): ActionBadge(), ACTIONS, AREA_LABELS, areaLabel(), ChangedFields(), DetailDialog(), fieldLabel(), formatValue() (+10 more)

### Community 42 - "Interview Question Admin"
Cohesion: 0.19
Nodes (18): CategoryDialogState, InterviewQuestionsAdminPage(), handleDeleteQuestion(), handleSaveCategory(), handleSaveQuestion(), handleToggleActive(), moveCategory(), moveQuestion() (+10 more)

### Community 43 - "Students List & Interview Centers"
Cohesion: 0.22
Nodes (14): StoredListState, StudentsPage(), AssignPanel(), InterviewCentersDialog(), assignInterviewCenter(), createInterviewCenter(), deleteInterviewCenter(), InterviewCenter (+6 more)

### Community 44 - "Exam Pass Rules"
Cohesion: 0.24
Nodes (17): Draft, FunnelBar(), RulesTab(), TabProps, toDraft(), evaluate(), funnel(), groupLabel() (+9 more)

### Community 45 - "compilerOptions Group"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 46 - "files Group"
Cohesion: 0.18
Nodes (14): EXTENSIONS, filesRouter, getObject(), looksLike(), readAll(), readImage(), sendFile(), sendObject() (+6 more)

### Community 47 - "dashboardService Group"
Cohesion: 0.16
Nodes (14): NgoTotalsChart, ProvinceChart, VisitorStatsChart, NgoTotalsChart(), ProvinceChart(), CategoryTick(), RankedBarChart(), VisitorStatsChart() (+6 more)

### Community 48 - "dependencies Group"
Cohesion: 0.12
Nodes (16): dependencies, @aws-sdk/client-s3@^3.1165.0, cookie-parser@^1.4.7, express@^5.3.0, firebase-admin@^14.0.0, ioredis@^5.6.1, multer@^2.0.2, sharp@^0.34.5 (+8 more)

### Community 49 - "lucide-react Group"
Cohesion: 0.19
Nodes (11): battambang, geistMono, geistSans, metadata, RootLayout(), viewport, OfflineBanner(), ServiceWorkerRegister() (+3 more)

### Community 50 - "CambodiaMap Group"
Cohesion: 0.20
Nodes (13): CambodiaMap(), metricValue(), colorForCount(), jitteredPosition(), MapColorBy, MapLayerFilter, partnerPosition(), studentValue() (+5 more)

### Community 51 - "environment Group"
Cohesion: 0.12
Nodes (16): environment, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DATABASE_URL, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_PROJECT_ID, NODE_ENV (+8 more)

### Community 52 - "x-api-env Group"
Cohesion: 0.12
Nodes (16): x-api-env, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DATABASE_URL, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_ADMIN_PROJECT_ID, NODE_ENV (+8 more)

### Community 53 - "Scholarship Selection Tracker  Group"
Cohesion: 0.17
Nodes (14): Home Visit photo upload flow, Original High-Level Architecture (Vercel/Supabase/Firebase), Database ERD, UI/UX Page Specifications, Private buckets + short-lived signed URLs, Docker Compose production topology on AWS EC2, migrate one-shot container, One-time data import from Supabase (+6 more)

### Community 54 - "ngoService Group"
Cohesion: 0.19
Nodes (13): EditNgoPage(), handleSubmit(), getNgo(), Ngo, NgoDetail, NgoFilterOption, NgoInsert, NgoListItem (+5 more)

### Community 55 - "resultsExport Group"
Cohesion: 0.17
Nodes (10): downloadXlsx(), downloadXlsxBook(), XlsxSheet, RESULT_COLOR, ResultsExport, ResultsExportRow, ResultStatusLabel, RESULT_CLASS (+2 more)

### Community 56 - "0037_dynamic_interview_questio Group"
Cohesion: 0.25
Nodes (13): idx_interview_answers_interview, idx_interview_answers_question, idx_interview_categories_name_active, idx_interview_questions_active, idx_interview_questions_category, interview_answers, interview_categories, interview_questions (+5 more)

### Community 57 - "0052_written_exams Group"
Cohesion: 0.28
Nodes (14): exam_candidates, exam_imports, exam_papers, exam_questions, exam_rules, exam_sheets, exam_subjects, idx_exam_candidates_cycle (+6 more)

### Community 59 - "compilerOptions Group 2"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule, rootDir (+5 more)

### Community 60 - "SocialForm Group"
Cohesion: 0.15
Nodes (13): ChoiceGroup(), ChoiceGroupLayout, LAYOUT_CLASSES, draftKey(), SectionHeading(), SocialForm(), handleSubmit(), labelFor() (+5 more)

### Community 61 - "RBAC defense in depth (RLS, Ro Group"
Cohesion: 0.17
Nodes (10): CLAUDE.md includes AGENTS.md, auth-bridge Edge Function (superseded), API Conventions (auth, pagination, errors, idempotency, rate limiting), lib/rbac.ts permission matrix helpers, Next.js 15 Project Structure, RoleGate component, Week 1 Foundation (auth, RBAC, students), API idempotency (api/src/idempotency.ts) (+2 more)

### Community 62 - "schoolService Group"
Cohesion: 0.23
Nodes (11): EditSchoolPage(), handleSubmit(), getSchoolPartner(), getSchoolPerformance(), School, SchoolDetail, SchoolInsert, SchoolListItem (+3 more)

### Community 63 - "services Group"
Cohesion: 0.15
Nodes (12): name, services, web, volumes, caddy_config, caddy_data, pgdata, redisdata (+4 more)

### Community 64 - "students table Group"
Cohesion: 0.15
Nodes (13): Exam Module (scores, total, rank, pass status), Home Visit Module, Interview Module, School Partner Management, Selection Committee (decision + PM approval), Student Management module, committee_decisions table, exam_results table (+5 more)

### Community 65 - "AI Data Assistant (NL to SQL) Group"
Cohesion: 0.18
Nodes (12): ai_summaries / ai_query_logs tables, AI Features API endpoints, Selection Committee API endpoints, AI Data Assistant chat page, Committee Queue and Dossier pages, Student Profile tabbed page, AI Data Assistant (NL to SQL), Selection Recommendation Engine (+4 more)

### Community 66 - "backup/page Group"
Cohesion: 0.30
Nodes (11): BackupPage(), handleExcel(), handleSql(), cellValue(), formatBytes(), nf, sheetName(), stamp() (+3 more)

### Community 67 - "NgoYearlyChart Group"
Cohesion: 0.41
Nodes (9): NgoYearlyChart(), axisProps, ChartEmpty(), ChartTooltip(), cursorProps, gridProps, gridPropsHorizontalBars, VIZ (+1 more)

### Community 68 - "CommitteeQueueCard Group"
Cohesion: 0.23
Nodes (11): CommitteeQueueCard(), GENDER_META, homeVisitStat(), interviewStat(), ratingStat(), SHORT_CATEGORY, Stat(), Tone (+3 more)

### Community 69 - "selection_cycles Group"
Cohesion: 0.30
Nodes (10): exam_center_stats, exam_result_stats, information_session_stats, interview_center_stats, interview_result_stats, trg_exam_center_stats_updated, trg_exam_result_stats_updated, trg_information_session_stats_updated (+2 more)

### Community 70 - "migrate Group"
Cohesion: 0.17
Nodes (12): postgres, APP_DB_PASSWORD, APP_DB_USER, MIGRATION_DATABASE_URL, SEED, command, depends_on, environment (+4 more)

### Community 71 - "Firebase to Supabase Third-Par Group"
Cohesion: 0.20
Nodes (11): Eight Stakeholder Personas / Roles, Firebase custom claims (role, ngo_id), POST /api/auth/session HTTP-only cookie, Admin Users & Roles API, ai_readonly Postgres role + restricted views, Admin-invited accounts only, Authentication Flow (Firebase ID token cookie), Least-privilege DB roles (+3 more)

### Community 72 - "ExamEntry Group"
Cohesion: 0.31
Nodes (7): ExamEntryPage(), ExamEntry(), handleSubmit(), examFormSchema, ExamFormValues, saveExamResult(), StudentDetail

### Community 73 - "audit_logs Group"
Cohesion: 0.27
Nodes (5): write_audit_log(), write_audit_log(), idx_audit_changed_at, idx_audit_table_changed_at, write_audit_log()

### Community 74 - "interview_centers Group"
Cohesion: 0.42
Nodes (7): apply_interview_outcome(), assign_interview_center(), idx_interview_centers_cycle, idx_students_interview_center, interview_centers, trg_audit_interview_centers, trg_interview_centers_updated

### Community 75 - "args Group"
Cohesion: 0.28
Nodes (9): build, NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, args, context, dockerfile, build (+1 more)

### Community 76 - "api Group"
Cohesion: 0.22
Nodes (9): depends_on, image, restart, volumes, migrate, redis, condition, condition (+1 more)

### Community 77 - "postgres Group"
Cohesion: 0.22
Nodes (9): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, environment, image, ports, restart, volumes (+1 more)

### Community 78 - "selection_cycles table Group"
Cohesion: 0.22
Nodes (7): selection_cycles table, Admin Users and Cycles pages, AWS scaling options (S3, RDS, ElastiCache, ALB, ECS Fargate), Per-cycle release checklist, Alumni / longitudinal outcome tracking, Partition transactional tables by cycle_id, Scale Hardening (partitioning, pooling, replicas, MVs, load tests)

### Community 79 - "migrate Group 2"
Cohesion: 0.32
Nodes (5): pg@^8.23.1, ensureAppRole(), findDir(), main(), pg

### Community 80 - "scripts Group"
Cohesion: 0.25
Nodes (8): scripts, build, dev, migrate, migrate:dev, migrate-storage, start, typecheck

### Community 81 - "migrate-storage Group"
Cohesion: 0.29
Nodes (7): BUCKETS, Entry, headers, listAll(), main(), supabaseUrl, storage

### Community 82 - "0053_exam_planning Group"
Cohesion: 0.43
Nodes (6): exam_centers, exam_rooms, exam_sessions, idx_exam_centers_cycle, idx_exam_rooms_center, idx_exam_sessions_center

### Community 83 - "caddy Group"
Cohesion: 0.25
Nodes (8): depends_on, environment, image, ports, restart, volumes, SITE_ADDRESS, caddy

### Community 84 - "redis Group"
Cohesion: 0.25
Nodes (8): REDIS_PASSWORD, command, environment, image, ports, restart, volumes, redis

### Community 85 - "Home Visit Entry mobile-first  Group"
Cohesion: 0.25
Nodes (7): v1 Out of Scope (payments, SMS, Khmer UI, native apps), Home Visit Entry mobile-first form with local draft, Home Visit Report Generator, 4-Week Development Roadmap, Post-MVP Feature Roadmap, Field Mode (Offline), /api/v1/offline/bundle download endpoint

### Community 86 - "eslint.config Group"
Cohesion: 0.25
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 87 - "Cambodia provinces GeoJSON (ge Group"
Cohesion: 0.29
Nodes (7): Cambodia GIS Choropleth Map, Administrative hierarchy provinces-districts-communes-villages, Dashboard & GIS API (mv_province_stats), Cambodia provinces GeoJSON (geojson_property_id join key), Cambodia GIS Map page + Province Detail, Roadmap risks (GeoJSON accuracy, auth bridge, field connectivity), Week 3 Dashboard, Map, Partners, Reporting

### Community 88 - "audit_logs (polymorphic) Group"
Cohesion: 0.29
Nodes (7): NGO Partner Management, Non-Functional Requirements (scale, performance, audit, offline), audit_logs (polymorphic), ngo_partners table, users / roles / user_roles / user_ngo_link, Audit logging via write_audit_log trigger, login_events table for admin activity dashboard

### Community 89 - "scripts Group 2"
Cohesion: 0.29
Nodes (7): scripts, api:dev, build, db:migrate, dev, lint, start

### Community 90 - "committee_ratings Group"
Cohesion: 0.53
Nodes (5): auth_user_id(), committee_ratings, idx_committee_ratings_cycle, idx_committee_ratings_student, trg_committee_ratings_updated

### Community 91 - "healthcheck Group"
Cohesion: 0.53
Nodes (6): interval, retries, test, timeout, healthcheck, healthcheck

### Community 92 - "remote-deploy Group"
Cohesion: 0.47
Nodes (4): copy(), MSYS_NO_PATHCONV, run(), remote-deploy.sh script

### Community 93 - "social_assessments Group"
Cohesion: 0.70
Nodes (4): idx_social_assessments_cycle, idx_social_assessments_student, social_assessments, trg_social_assessments_updated

### Community 94 - "exam_score_overrides Group"
Cohesion: 0.70
Nodes (4): exam_score_overrides, idx_exam_score_overrides_paper, trg_audit_exam_score_overrides, trg_exam_score_overrides_updated

### Community 97 - "exam_key_versions Group"
Cohesion: 0.83
Nodes (3): exam_key_versions, trg_audit_exam_key_versions, trg_exam_key_versions_updated

### Community 98 - "Six-Stage Selection Pipeline Group"
Cohesion: 0.50
Nodes (4): PRD Product Vision, Six-Stage Selection Pipeline, Student status lifecycle, Week 2 Core Pipeline Modules

### Community 99 - "clsx Group"
Cohesion: 0.33
Nodes (4): clsx@^2.1.1, leaflet@^1.9.4, clsx, leaflet

### Community 100 - "server-install Group"
Cohesion: 0.83
Nodes (3): dk(), server-install.sh script, step()

### Community 101 - "overrides Group"
Cohesion: 0.67
Nodes (3): jose, overrides, jwks-rsa

### Community 103 - "Reports API (enqueue + poll) Group"
Cohesion: 0.67
Nodes (3): Reporting & Export (PDF/Excel/CSV), Reports API (enqueue + poll), Reports builder page

## Ambiguous Edges - Review These
- `Express 5 REST API (api/)` → `Two API layers: PostgREST direct + Route Handlers`  [AMBIGUOUS]
  docs/05-api-design.md · relation: semantically_similar_to

## Knowledge Gaps
- **49 isolated node(s):** `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 650 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **72 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Dropdown Menus` to `Offline Sync & API Client`, `Form Inputs & Selects`, `Exam Scoring & ZipGrade`, `Dialogs & Exam Papers`, `Selection Process Dashboard`, `Social Form Scoring`, `Admin Tables & Cycles`, `Interview Form & Pass Rule`, `Committee Review Services`, `Finalist Reports`, `Cards & Committee Queue`, `Exam Candidates Tab`, `NGO & School Partners`, `Auth & App Layout`, `Committee Presentation`, `Student Detail & Field Mode`, `Student Cards & Badges`, `Social Form Field Entry`, `Buttons & User Admin`, `Cambodia Map`, `Exam Results Tab`, `Main Dashboard`, `Exam Center Planning`, `Audit Log Viewer`, `Interview Question Admin`, `Students List & Interview Centers`, `SocialForm Group`, `backup/page Group`, `CommitteeQueueCard Group`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV`, `MSYS_NO_PATHCONV` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Offline Sync & API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.05274725274725275 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Dialogs & Exam Papers` to `Offline Sync & API Client`, `Form Inputs & Selects`, `Exam Scoring & ZipGrade`, `Student Import & Lookups`, `Social Form Scoring`, `Admin Tables & Cycles`, `Interview Form & Pass Rule`, `Committee Review Services`, `Finalist Reports`, `Cards & Committee Queue`, `Exam Candidates Tab`, `NGO & School Partners`, `Auth & App Layout`, `Committee Presentation`, `Student Visit Report`, `Student Detail & Field Mode`, `Student Cards & Badges`, `Dropdown Menus`, `Social Form Field Entry`, `Buttons & User Admin`, `Cambodia Map`, `Exam Results Tab`, `Exam Center Planning`, `Audit Log Viewer`, `Interview Question Admin`, `Students List & Interview Centers`, `Exam Pass Rules`, `SocialForm Group`, `backup/page Group`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `Initial DB Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.05847781369379959 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Social Form Field Entry` to `Offline Sync & API Client`, `Form Inputs & Selects`, `Exam Scoring & ZipGrade`, `Dialogs & Exam Papers`, `Selection Process Dashboard`, `Student Import & Lookups`, `Social Form Scoring`, `Admin Tables & Cycles`, `Interview Form & Pass Rule`, `Committee Review Services`, `Finalist Reports`, `Cards & Committee Queue`, `Exam Candidates Tab`, `NGO & School Partners`, `Auth & App Layout`, `Committee Presentation`, `Student Visit Report`, `Student Detail & Field Mode`, `Student Cards & Badges`, `Dropdown Menus`, `Buttons & User Admin`, `Cambodia Map`, `Exam Results Tab`, `Frontend Dev Dependencies`, `Frontend Dependencies`, `Main Dashboard`, `Exam Center Planning`, `Audit Log Viewer`, `Interview Question Admin`, `Students List & Interview Centers`, `Exam Pass Rules`, `lucide-react Group`, `ngoService Group`, `resultsExport Group`, `schoolService Group`, `backup/page Group`, `NgoYearlyChart Group`, `CommitteeQueueCard Group`, `ExamEntry Group`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Express 5 REST API (api/)` and `Two API layers: PostgREST direct + Route Handlers`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._