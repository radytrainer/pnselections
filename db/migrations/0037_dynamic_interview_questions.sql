-- Lets Super Admin manage interview self-assessment questions/categories from
-- the app instead of them being hardcoded in components/forms/InterviewForm.tsx.
-- Replaces the fixed interviews.q1_score..q16_score columns with a normalized
-- question bank + per-question answers, so the question count/categories can
-- change without a schema migration.
--
-- Additive only, per the deployment discipline in docs/10-deployment.md
-- ("never drop a column in the same release that removes its usage") —
-- interviews.q1_score..q16_score and interviews.recommendation are left in
-- place untouched. The app stops writing to q1_score..q16_score after this
-- ships, but they aren't dropped here.

-- ----------------------------------------------------------------------------
-- 1. interview_categories — replaces the hardcoded CATEGORIES array label.
-- ----------------------------------------------------------------------------
create table interview_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index idx_interview_categories_name_active
  on interview_categories (lower(name)) where deleted_at is null;
create trigger trg_interview_categories_updated before update on interview_categories
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. interview_questions — replaces the hardcoded per-category question list.
--    is_active/deleted_at support deactivating a question without losing the
--    history of interview_answers rows that already reference it.
-- ----------------------------------------------------------------------------
create table interview_questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references interview_categories(id) on delete restrict,
  text_en text not null,
  text_km text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_interview_questions_category on interview_questions(category_id) where deleted_at is null;
create index idx_interview_questions_active on interview_questions(is_active) where deleted_at is null;
create trigger trg_interview_questions_updated before update on interview_questions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. interview_answers — replaces interviews.q1_score..q16_score. One row per
--    (interview, question). question_id is on-delete-restrict — deleting a
--    question out from under existing answers is never allowed; deactivate
--    it instead (is_active/deleted_at), matching this schema's soft-delete
--    convention everywhere else.
-- ----------------------------------------------------------------------------
create table interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  question_id uuid not null references interview_questions(id) on delete restrict,
  score int not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, question_id)
);
create index idx_interview_answers_interview on interview_answers(interview_id);
create index idx_interview_answers_question on interview_answers(question_id);
create trigger trg_interview_answers_updated before update on interview_answers
  for each row execute function set_updated_at();

create trigger trg_audit_interview_questions after insert or update on interview_questions
  for each row execute function write_audit_log();
create trigger trg_audit_interview_answers after insert or update on interview_answers
  for each row execute function write_audit_log();

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security
-- ----------------------------------------------------------------------------
alter table interview_categories enable row level security;
alter table interview_questions enable row level security;
alter table interview_answers enable row level security;

-- Categories/questions: same read audience as interviews_select (everyone who
-- can see interview data needs to read the question bank to render the form
-- or historical answers) — only super_admin can create/edit them.
create policy interview_categories_select on interview_categories for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                  'committee_member','donor')
);
create policy interview_categories_write on interview_categories for insert with check (
  auth_role() = 'super_admin'
);
create policy interview_categories_update on interview_categories for update using (
  auth_role() = 'super_admin'
);

create policy interview_questions_select on interview_questions for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                  'committee_member','donor')
);
create policy interview_questions_write on interview_questions for insert with check (
  auth_role() = 'super_admin'
);
create policy interview_questions_update on interview_questions for update using (
  auth_role() = 'super_admin'
);

-- Answers: mirrors interviews_select/write/update exactly (0001 §14) — same
-- roles that can read/write interview scores today.
create policy interview_answers_select on interview_answers for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                  'committee_member','donor')
);
create policy interview_answers_write on interview_answers for insert with check (
  auth_role() in ('super_admin','program_manager','interview_team')
);
create policy interview_answers_update on interview_answers for update using (
  auth_role() in ('super_admin','program_manager','interview_team')
);

-- ----------------------------------------------------------------------------
-- 5. Seed the 16 existing hardcoded questions (verbatim from
--    components/forms/InterviewForm.tsx) and backfill every existing
--    interviews.q1_score..q16_score value into interview_answers rows
--    referencing the newly seeded questions, so no existing student data
--    is lost. Assumes interview_categories/interview_questions are empty
--    before this migration runs (true on first apply).
-- ----------------------------------------------------------------------------
do $$
declare
  v_cat_motivation uuid;
  v_cat_resilience uuid;
  v_cat_collaboration uuid;
begin
  insert into interview_categories (name, display_order) values ('Motivation in IT', 1)
    returning id into v_cat_motivation;
  insert into interview_categories (name, display_order) values ('Study Resilience', 2)
    returning id into v_cat_resilience;
  insert into interview_categories (name, display_order) values ('Group Work / Collaboration', 3)
    returning id into v_cat_collaboration;

  -- Motivation in IT (q1-q6)
  insert into interview_questions (category_id, text_en, text_km, display_order) values
    (v_cat_motivation, 'I like breaking complex problems into smaller, easy-to-solve pieces.',
      'ខ្ញុំចូលចិត្តបំបែកបញ្ហាស្មុគស្មាញ ឱ្យទៅជាផ្នែកតូចៗ ដែលងាយស្រួលដោះស្រាយ។', 1),
    (v_cat_motivation, 'When encountering bugs or technical issues, my first instinct is to understand the root cause rather than just fix it quickly.',
      'នៅពេលជួបបញ្ហាបច្ចេកទេស ឬ "Bug" ការគិតដំបូងរបស់ខ្ញុំគឺចង់ដឹងពីមូលហេតុ ដែលវាកើតឡើង ជាជាងត្រាន់តែចង់ជួសជុលវាឱ្យរួចពីម្ដ។', 2),
    (v_cat_motivation, 'How important is it to create new things that are unique, smart, and attractive?',
      'តើអ្នកគិតថាមានសារសំខាន់បុណ្ណាក្នុងការបង្កើតអ្វីថ្មីៗ ដែលមានលក្ខណៈប្លែក ស្មាត និងទាក់ទាញ?', 3),
    (v_cat_motivation, 'I want a career in the technology field.',
      'ខ្ញុំចង់មានអាជីព/ការងារមួយនៅក្នុងវិស័យបច្ចេកវិទ្យា។', 4),
    (v_cat_motivation, 'I agree there are often multiple ways to solve a problem, not just one "correct" way.',
      'ខ្ញុំយល់ស្របនឹងគំនិតដែលថា ជាញឹកញាប់មានវិធីដោះស្រាយ ជៀសជាង "ត្រឹមត្រូវ" ជាងមួយ ដើម្បីដោះស្រាយបញ្ហាអ្វីមួយ។', 5),
    (v_cat_motivation, 'I like learning to use new tools and software to develop myself.',
      'ខ្ញុំចូលចិត្តរៀនប្រើប្រាស់ឧបករណ៍ និងកម្មវិធីថ្មីៗ ដើម្បីអភិវឌ្ឍន៍ខ្លួន។', 6);

  -- Study Resilience (q7-q10)
  insert into interview_questions (category_id, text_en, text_km, display_order) values
    (v_cat_resilience, 'How important is understanding and applying approaches to solve complex problems?',
      'តើអ្នកគិតថាមានសារសំខាន់បុណ្ណាក្នុងការយល់ និងអនុវត្តតាមបញ្ហាតិច ឬការណែនំ រៀបបំបែកបញ្ហាស្មុគស្មាញ?', 1),
    (v_cat_resilience, 'How important is using new ideas and creative thinking for new things?',
      'តើអ្នកគិតថាមានសារសំខាន់បុណ្ណាក្នុងការប្រើគំនិតថ្មី និងការប្រឌិតអំពីដំណើរការអ្វីថ្មីៗ?', 2),
    (v_cat_resilience, 'I like explaining technical concepts to others or helping them solve problems with their devices.',
      'ខ្ញុំចូលចិត្តពន្យល់ពីបញ្ហាបច្ចេកទេសដល់អ្នកដ៏ទៃ ឬជួយដោះស្រាយបញ្ហាឧបករណ៍ប្រើប្រាស់របស់ពួកគេ។', 3),
    (v_cat_resilience, 'The program lasts 2 years and is quite complex. If problems arise or your family needs you, will you continue your studies?',
      'កម្មវិធីសិក្សាមានរយៈពេល ២ ឆ្នាំ ហើយមានស្មុគស្មាញណាស់។ ពេលមានបញ្ហា ឬ គ្រួសាររបស់អ្នកត្រូវការអ្នក តើអ្នកនឹងបន្តដើរតាមការសិក្សារបស់អ្នកឬទេ?', 4);

  -- Group Work / Collaboration (q11-q16)
  insert into interview_questions (category_id, text_en, text_km, display_order) values
    (v_cat_collaboration, 'How important is understanding and empathizing with the problems of others?',
      'តើអ្នកគិតថាមានសារសំខាន់បុណ្ណាក្នុងការយកយល់ និងយល់ចិត្តចំពោះបញ្ហារបស់អ្នកដ៏ទៃ?', 1),
    (v_cat_collaboration, 'When receiving bad grades or failing a project, I tend to refocus on learning ("recover") rather than complaining about the failure.',
      'នៅពេលទទួលបានពិន្ទុមិនល្អ ឬគម្រោងត្រូវបានបរាជ័យ ខ្ញុំមានទំនោររៀនឡើងវិញ "សង្គ្រោះបច្ចុប្បន្ន" ជាជាងការរអ៊ូទាំពីការបរាជ័យ។', 2),
    (v_cat_collaboration, 'I believe skill comes from effort and practice, not innate talent.',
      'ខ្ញុំជឿថាការរៀនពូកែ ផ្អែកលើជំនាញ ដែលខ្ញុំអាចបង្ហាញតាមរយៈការខិតខំប្រឹងប្រែង មិនមែនជាទេពកោសល្យពីកំណើតនោះទេ។', 3),
    (v_cat_collaboration, 'I use effective body language to strengthen my communication.',
      'ខ្ញុំប្រើភាសាកាយវិការដ៏មានប្រសិទ្ធភាព ដើម្បីពង្រឹងការទំនាក់ទំនងរបស់ខ្ញុំ។', 4),
    (v_cat_collaboration, 'I communicate comfortably with respect and manage conversations professionally.',
      'ខ្ញុំប្រាស្រ័យទាក់ទងដោយភាពស្រួលចិត្ត ជាមួយការគោរព និងគ្រប់គ្រងការសន្ទនាដោយវិជ្ជាជីវៈ។', 5),
    (v_cat_collaboration, 'I enjoy community life and feel responsible for the wellbeing of others.',
      'ខ្ញុំរីករាយជាមួយជីវិតសហគមន៍ និងមានការទទួលខុសត្រូវចំពោះសុខុមាលភាពរបស់អ្នកដទៃ?', 6);
end $$;

-- Migrate existing interviews.q1_score..q16_score into interview_answers,
-- matching each qN_score column to the Nth seeded question across all 3
-- categories concatenated in seed order (q1=motivation#1 ... q6=motivation#6,
-- q7=resilience#1 ... q10=resilience#4, q11=collaboration#1 ... q16=collaboration#6).
do $$
declare
  ordered_questions uuid[];
begin
  select array_agg(q.id order by c.display_order, q.display_order)
    into ordered_questions
  from interview_questions q
  join interview_categories c on c.id = q.category_id;

  insert into interview_answers (interview_id, question_id, score)
  select iv.id, ordered_questions[n], score
  from interviews iv
  cross join lateral (values
    (1, iv.q1_score), (2, iv.q2_score), (3, iv.q3_score), (4, iv.q4_score),
    (5, iv.q5_score), (6, iv.q6_score), (7, iv.q7_score), (8, iv.q8_score),
    (9, iv.q9_score), (10, iv.q10_score), (11, iv.q11_score), (12, iv.q12_score),
    (13, iv.q13_score), (14, iv.q14_score), (15, iv.q15_score), (16, iv.q16_score)
  ) as scores(n, score)
  where score is not null
  on conflict (interview_id, question_id) do nothing;
end $$;
