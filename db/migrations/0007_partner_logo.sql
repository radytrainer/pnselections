-- ============================================================================
-- Adds a logo image to NGO/school partners — a public storage bucket (logos
-- aren't sensitive, unlike student-documents) plus a logo_url column on each
-- partner table pointing at the uploaded object's public URL.
-- ============================================================================

alter table ngo_partners add column logo_url text;
alter table school_partners add column logo_url text;

-- [self-hosted] The Supabase Storage bucket + storage.objects policies that
-- used to live here (public `partner-logos` bucket; writes limited to super_admin/program_manager/ngo_partner) are now enforced by the Node.js API's upload/
-- download routes (api/src/routes/files.ts), which store objects on a local
-- volume or S3 instead of Supabase Storage.
