-- Replaces the simple home_visits form with the NGO's full poverty/
-- vulnerability scoring rubric ("Home Visit Form with Full Scoring").
-- home_visits itself is left in place (existing rows aren't migrated —
-- the two schemas don't map cleanly) but the app no longer writes to it.

create table social_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id),
  visit_number int not null default 1,

  -- Section 1 - Health & Academic
  health_status text check (health_status in ('healthy','simple_disease','chronic_disease')),
  ok_to_join_training text,
  academic_rank text check (academic_rank in ('outstanding_ab','good_cd','average_e')),

  -- Section 2 - Household Profile
  household_size_band text check (household_size_band in ('1_3','4_6','7_plus')),
  household_size_note text,
  dependents_band text check (dependents_band in ('none','1_2','3_plus')),
  dependents_note text,
  father_age int,
  father_job text,
  mother_age int,
  mother_job text,
  parent_occupation_band text check (parent_occupation_band in (
    'unemployed','daily_laborer','farmer','small_business','stable_salaried'
  )),

  -- Section 3 - Housing & Living Conditions (+ Electricity Access)
  house_owner text,
  housing_type_band text check (housing_type_band in ('makeshift','wooden_zinc','brick_concrete','permanent')),
  house_status_band text check (house_status_band in ('rented','family_fragile','family_fair','family_strong')),
  water_access_band text check (water_access_band in ('river_pond','communal_well','own_well','piped')),
  electricity_access_band text check (electricity_access_band in ('none','shared_solar','regular')),

  -- Section 4 - Household Assets (rank 0-3 each)
  assets_furniture int check (assets_furniture between 0 and 3),
  assets_transport int check (assets_transport between 0 and 3),
  assets_electronics int check (assets_electronics between 0 and 3),
  assets_livestock int check (assets_livestock between 0 and 3),

  -- Section 5/6 - Income & Expenses (monthly estimate)
  income_band text check (income_band in ('lt_100','101_200','201_400','gt_400')),
  income_note text,
  expenses_band text check (expenses_band in ('lt_100','101_200','201_400','gt_400')),
  expenses_note text,

  -- Section 7 - Education Support Capacity
  education_support_band text check (education_support_band in ('no','maybe','yes')),
  education_support_note text,

  -- Section 8 - Educational Background of Household
  father_education_band text check (father_education_band in ('none','primary','secondary','high_school_above')),
  mother_education_band text check (mother_education_band in ('none','primary','secondary','high_school_above')),
  school_aged_children_studying int,
  school_aged_children_working int,
  school_attendance_band text check (school_attendance_band in ('none','some_irregular','most_attend','all_attend')),

  -- Section 9 - Debt Situation
  debt_band text check (debt_band in ('no_debt','small_manageable','high_burden','very_high_risk')),
  debt_amount text,

  -- Section 10 - Farming Field
  farm_land_band text check (farm_land_band in ('landless','small','medium','large')),
  farm_income_band text check (farm_income_band in ('none','minimal','moderate','major')),

  -- Section 11 - Plantation Field
  plantation_land_band text check (plantation_land_band in ('landless','small','medium','large')),
  plantation_income_band text check (plantation_income_band in ('none','minimal','moderate','major')),

  -- Section 12 - Vulnerability Factors (each ticked = -1 on final_score)
  vulnerability_orphan_single_parent boolean not null default false,
  vulnerability_disability boolean not null default false,
  vulnerability_chronic_illness boolean not null default false,
  vulnerability_debt_burden boolean not null default false,
  vulnerability_landless boolean not null default false,

  -- Section 13 - Husbandry
  husbandry_band text check (husbandry_band in ('none','small','medium','large')),

  -- Computed by the app (features/social-form/scoring.ts) and stored so the
  -- committee queue/dossier can sort/filter/display without recomputing.
  total_score int not null,
  vulnerability_deduction int not null default 0,
  final_score int not null,
  category text not null check (category in ('very_poor','poor','medium','relatively_well_off')),

  poverty_certificate text,
  distance_from_town text,
  visitor_name text,
  visitor_comments text,

  visitor_id uuid references users(id),
  visit_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, visit_number)
);
create index idx_social_assessments_student on social_assessments(student_id);
create index idx_social_assessments_cycle on social_assessments(cycle_id);
create trigger trg_social_assessments_updated before update on social_assessments
  for each row execute function set_updated_at();

alter table social_assessments enable row level security;

create policy social_assessments_select on social_assessments for select using (
  auth_role() in ('super_admin','program_manager','home_visit_team','committee_member','donor')
);
create policy social_assessments_write on social_assessments for insert with check (
  auth_role() in ('super_admin','program_manager','home_visit_team')
);
create policy social_assessments_update on social_assessments for update using (
  auth_role() in ('super_admin','program_manager','home_visit_team')
);
