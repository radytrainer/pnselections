-- Replace the old gender check constraint (male/female/other) with one that
-- accepts lgbtqia+ instead of other. Existing rows with gender='other' are
-- updated to 'lgbtqia+' first so the new constraint doesn't reject them.

update students set gender = 'lgbtqia+' where gender = 'other';

alter table students
  drop constraint if exists students_gender_check;

alter table students
  add constraint students_gender_check check (gender in ('male', 'female', 'lgbtqia+'));
