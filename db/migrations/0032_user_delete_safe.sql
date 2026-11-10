-- Allow users to be deleted without FK violations.
-- All nullable references become SET NULL; the two NOT NULL author/rater
-- columns are relaxed to nullable so historical records are preserved.

-- audit_logs
alter table audit_logs
  drop constraint if exists audit_logs_changed_by_fkey;
alter table audit_logs
  add constraint audit_logs_changed_by_fkey
  foreign key (changed_by) references users(id) on delete set null;

-- social_assessments
alter table social_assessments
  drop constraint if exists social_assessments_visitor_id_fkey;
alter table social_assessments
  add constraint social_assessments_visitor_id_fkey
  foreign key (visitor_id) references users(id) on delete set null;

-- user_roles
alter table user_roles
  drop constraint if exists user_roles_granted_by_fkey;
alter table user_roles
  add constraint user_roles_granted_by_fkey
  foreign key (granted_by) references users(id) on delete set null;

-- ngo_partners
alter table ngo_partners
  drop constraint if exists ngo_partners_created_by_fkey,
  drop constraint if exists ngo_partners_updated_by_fkey;
alter table ngo_partners
  add constraint ngo_partners_created_by_fkey
    foreign key (created_by) references users(id) on delete set null,
  add constraint ngo_partners_updated_by_fkey
    foreign key (updated_by) references users(id) on delete set null;

-- school_partners
alter table school_partners
  drop constraint if exists school_partners_created_by_fkey,
  drop constraint if exists school_partners_updated_by_fkey;
alter table school_partners
  add constraint school_partners_created_by_fkey
    foreign key (created_by) references users(id) on delete set null,
  add constraint school_partners_updated_by_fkey
    foreign key (updated_by) references users(id) on delete set null;

-- students
alter table students
  drop constraint if exists students_created_by_fkey,
  drop constraint if exists students_updated_by_fkey;
alter table students
  add constraint students_created_by_fkey
    foreign key (created_by) references users(id) on delete set null,
  add constraint students_updated_by_fkey
    foreign key (updated_by) references users(id) on delete set null;

-- student_documents
alter table student_documents
  drop constraint if exists student_documents_uploaded_by_fkey;
alter table student_documents
  add constraint student_documents_uploaded_by_fkey
  foreign key (uploaded_by) references users(id) on delete set null;

-- home_visits
alter table home_visits
  drop constraint if exists home_visits_visitor_id_fkey;
alter table home_visits
  add constraint home_visits_visitor_id_fkey
  foreign key (visitor_id) references users(id) on delete set null;

-- committee_decisions
alter table committee_decisions
  drop constraint if exists committee_decisions_approved_by_fkey;
alter table committee_decisions
  add constraint committee_decisions_approved_by_fkey
  foreign key (approved_by) references users(id) on delete set null;

-- committee_notes (author_id was NOT NULL — relax to nullable to preserve notes)
alter table committee_notes
  alter column author_id drop not null;
alter table committee_notes
  drop constraint if exists committee_notes_author_id_fkey;
alter table committee_notes
  add constraint committee_notes_author_id_fkey
  foreign key (author_id) references users(id) on delete set null;

-- committee_ratings (rated_by was NOT NULL — relax to nullable to preserve ratings)
alter table committee_ratings
  alter column rated_by drop not null;
alter table committee_ratings
  drop constraint if exists committee_ratings_rated_by_fkey;
alter table committee_ratings
  add constraint committee_ratings_rated_by_fkey
  foreign key (rated_by) references users(id) on delete set null;

-- ai_summaries
alter table ai_summaries
  drop constraint if exists ai_summaries_generated_by_fkey;
alter table ai_summaries
  add constraint ai_summaries_generated_by_fkey
  foreign key (generated_by) references users(id) on delete set null;

-- ai_query_logs
alter table ai_query_logs
  drop constraint if exists ai_query_logs_user_id_fkey;
alter table ai_query_logs
  add constraint ai_query_logs_user_id_fkey
  foreign key (user_id) references users(id) on delete set null;

-- reports
alter table reports
  drop constraint if exists reports_generated_by_fkey;
alter table reports
  add constraint reports_generated_by_fkey
  foreign key (generated_by) references users(id) on delete set null;
