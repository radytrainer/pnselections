-- ============================================================================
-- Fix: districts/communes/villages were never seeded (provinces are; those
-- three tables are empty), so every District/Commune/Village dropdown tied to
-- them was permanently empty — picking a Province never surfaced any further
-- options. Rather than fabricate thousands of administrative-division rows,
-- replace those FK-linked selects with free-text fields the user fills in
-- directly. Province stays a real select (provinces data is accurate and
-- seeded). The districts/communes/villages tables and their RLS policies are
-- left in place (harmless, unused) in case real data is seeded later.
-- ============================================================================

alter table students
  add column district_name text,
  add column commune_name text,
  add column village_name text;

update students set district_name = (select name_en from districts where id = students.district_id);
update students set commune_name = (select name_en from communes where id = students.commune_id);
update students set village_name = (select name_en from villages where id = students.village_id);

alter table students
  drop column district_id,
  drop column commune_id,
  drop column village_id;

alter table ngo_partners add column district_name text;
update ngo_partners set district_name = (select name_en from districts where id = ngo_partners.district_id);
alter table ngo_partners drop column district_id;

alter table school_partners add column district_name text;
update school_partners set district_name = (select name_en from districts where id = school_partners.district_id);
alter table school_partners drop column district_id;
