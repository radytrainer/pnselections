-- Recruitment-stage fields used on the NGO's information-session sign-up
-- sheet, captured at registration alongside the existing student fields.
alter table students add column information_session text;
alter table students add column exam_center text;
alter table students add column eligible_for_social_investigation boolean not null default false;
