-- Date of birth is often unknown at the information-session registration
-- stage and gets filled in later, so it's no longer a hard requirement.
alter table students alter column dob drop not null;
