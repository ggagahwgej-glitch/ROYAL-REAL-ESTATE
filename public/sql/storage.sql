-- ==================================================================
-- STORAGE BUCKETS & POLICIES
-- Public buckets contain ONLY intentionally public media/branding.
-- Private assets live in a protected bucket with owner-only policies.
-- ==================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media', 'property-media', true, 125829120,
    array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm','video/quicktime']),
  ('branding', 'branding', true, 5242880,
    array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('owner-private', 'owner-private', false, 26214400, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for public buckets (public buckets also serve via /object/public).
drop policy if exists "public read property media" on storage.objects;
create policy "public read property media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'property-media');
drop policy if exists "public read branding" on storage.objects;
create policy "public read branding" on storage.objects
  for select to anon, authenticated using (bucket_id = 'branding');

-- Only the verified owner may write to any bucket.
drop policy if exists "owner insert media" on storage.objects;
create policy "owner insert media" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('property-media','branding','owner-private') and public.is_owner()
  );
drop policy if exists "owner update media" on storage.objects;
create policy "owner update media" on storage.objects
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists "owner delete media" on storage.objects;
create policy "owner delete media" on storage.objects
  for delete to authenticated using (public.is_owner());

-- Private bucket read is owner-only (no anon policy exists for it).
drop policy if exists "owner read private" on storage.objects;
create policy "owner read private" on storage.objects
  for select to authenticated using (bucket_id = 'owner-private' and public.is_owner());
