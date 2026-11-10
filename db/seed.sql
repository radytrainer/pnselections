-- ============================================================================
-- Reference seed data — run once after docs/04-schema.sql
-- ============================================================================
-- NOTE on Khmer names: name_kh values below are provided as a starting point.
-- Before production use, verify every Khmer label against an authoritative
-- source (e.g. Cambodia National Institute of Statistics gazetteer, or the
-- GADM/OpenStreetMap admin boundary dataset you choose for the GeoJSON layer)
-- and reconcile `geojson_property_id` with the actual property key/value in
-- the GeoJSON file you load into React Leaflet (commonly `NAME_1` or `shapeName`
-- in GADM-derived Cambodia province boundaries).
-- ============================================================================

insert into provinces (code, name_en, name_kh, geojson_property_id) values
  ('BMC', 'Banteay Meanchey', 'បន្ទាយមានជ័យ', 'Banteay Meanchey'),
  ('BTB', 'Battambang',       'បាត់ដំបង',       'Battambang'),
  ('KPC', 'Kampong Cham',     'កំពង់ចាម',       'Kampong Cham'),
  ('KPN', 'Kampong Chhnang',  'កំពង់ឆ្នាំង',     'Kampong Chhnang'),
  ('KPSP','Kampong Speu',     'កំពង់ស្ពឺ',       'Kampong Speu'),
  ('KPT', 'Kampong Thom',     'កំពង់ធំ',        'Kampong Thom'),
  ('KPT2','Kampot',           'កំពត',           'Kampot'),
  ('KAN', 'Kandal',           'កណ្ដាល',         'Kandal'),
  ('KEP', 'Kep',              'កែប',            'Kep'),
  ('KOH', 'Koh Kong',         'កោះកុង',         'Koh Kong'),
  ('KRT', 'Kratie',           'ក្រចេះ',          'Kratie'),
  ('MDK', 'Mondulkiri',       'មណ្ឌលគិរី',       'Mondulkiri'),
  ('OMC', 'Oddar Meanchey',   'ឧត្ដរមានជ័យ',     'Oddar Meanchey'),
  ('PLN', 'Pailin',           'ប៉ៃលិន',          'Pailin'),
  ('PNH', 'Phnom Penh',       'ភ្នំពេញ',         'Phnom Penh'),
  ('PSH', 'Preah Sihanouk',   'ព្រះសីហនុ',       'Preah Sihanouk'),
  ('PVH', 'Preah Vihear',     'ព្រះវិហារ',       'Preah Vihear'),
  ('PVG', 'Prey Veng',        'ព្រៃវែង',         'Prey Veng'),
  ('PST', 'Pursat',           'ពោធិ៍សាត់',       'Pursat'),
  ('RTK', 'Ratanakiri',       'រតនគិរី',         'Ratanakiri'),
  ('SRP', 'Siem Reap',        'សៀមរាប',         'Siem Reap'),
  ('STR', 'Stung Treng',      'ស្ទឹងត្រែង',       'Stung Treng'),
  ('SVR', 'Svay Rieng',       'ស្វាយរៀង',        'Svay Rieng'),
  ('TKO', 'Takeo',            'តាកែវ',          'Takeo'),
  ('TBK', 'Tboung Khmum',     'ត្បូងឃ្មុំ',       'Tboung Khmum')
on conflict (code) do nothing;

insert into roles (name, description) values
  ('super_admin',     'Full system access and configuration'),
  ('program_manager', 'Cross-province oversight, cycle setup, final reporting'),
  ('selection_team',  'Manages IS intake and entrance exam scoring'),
  ('interview_team',  'Conducts and scores motivation interviews'),
  ('home_visit_team', 'Conducts household visits and uploads visit evidence'),
  ('committee_member','Reviews consolidated student data and records decisions'),
  ('ngo_partner',     'Referring NGO — scoped visibility to own referred students'),
  ('donor',           'Read-only access to aggregate dashboards and reports')
on conflict (name) do nothing;

insert into selection_cycles (year, name, start_date, end_date, exam_pass_threshold, status)
values (2026, '2026 Selection Cycle', '2026-01-15', '2026-11-30', 50.00, 'active')
on conflict (year) do nothing;
