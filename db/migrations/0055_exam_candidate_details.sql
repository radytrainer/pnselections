-- Candidate details for the printed attendance sheet (ID number, first name,
-- last name, gender, DoB, high school, exam center, province, NGO).
-- Candidates linked to a student use the student's record; these columns hold
-- the values for candidates imported from a list who aren't students yet.
-- full_name stays the display name (first + last when both are known).
alter table exam_candidates
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists dob date,
  add column if not exists high_school text,
  add column if not exists province text,
  add column if not exists ngo text;
