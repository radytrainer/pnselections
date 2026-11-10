-- Originally added committee_ratings to the `supabase_realtime` publication so
-- the Committee Dossier page received live vote updates.
--
-- [self-hosted] Live updates now go through Redis pub/sub: the API publishes
-- an event after every rating upsert and streams it to the dossier page over
-- Server-Sent Events (api/src/routes/committee.ts). The stream only carries
-- "something changed for student X"; the page then refetches through the
-- normal RLS-checked endpoint, and committee_member callers are only notified
-- about their own vote (mirroring migration 0021). Nothing to do in SQL.
select 1;
