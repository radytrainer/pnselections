-- Selection Process → Exam Results: attendance and failures by gender, so the
-- page can show girls/boys percentages for those who sat, passed and failed.
-- Filled automatically from the Written Exams module (features/written-exam/sync.ts).
alter table exam_result_stats
  add column if not exists attended_girls int not null default 0,
  add column if not exists attended_boys int not null default 0,
  add column if not exists failed int not null default 0,
  add column if not exists failed_girls int not null default 0,
  add column if not exists failed_boys int not null default 0;
