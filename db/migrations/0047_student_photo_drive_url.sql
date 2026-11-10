-- Link to the student's photos stored in Google Drive (not uploaded to Supabase storage).
alter table students
  add column if not exists photo_drive_url text;
