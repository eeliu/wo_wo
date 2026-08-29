-- ============================================
-- Word notebook - Storage bucket and permissions
-- Run this file in the Supabase SQL Editor
-- Used to store images uploaded for words
-- ============================================

-- Create a private word-images bucket; signed-in users can upload and view their own images.
insert into storage.buckets (id, name, public)
values ('word-images', 'word-images', false)
on conflict (id) do update set public = false;

-- ============================================
-- Storage bucket policies
-- Each user can manage only their own uploaded images
-- File path convention: {user_id}/{filename}
-- ============================================

drop policy if exists "Users can upload own images" on storage.objects;
drop policy if exists "Users can view own images" on storage.objects;
drop policy if exists "Users can delete own images" on storage.objects;

-- Allow signed-in users to upload images under their own user_id
create policy "Users can upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'word-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow signed-in users to view their own images
create policy "Users can view own images"

  on storage.objects for select
  using (
    bucket_id = 'word-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow signed-in users to delete their own images
create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'word-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
