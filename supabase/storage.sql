-- ============================================
-- 单词记录工具 - Storage 存储桶与权限
-- 在 Supabase SQL Editor 中运行此文件
-- 用于存储用户上传的单词图片
-- ============================================

-- 创建存储桶：word-images（公开可读，仅登录用户可上传）
insert into storage.buckets (id, name, public)
values ('word-images', 'word-images', true)
on conflict (id) do nothing;

-- ============================================
-- 存储桶权限策略
-- 每个用户只能管理自己上传的图片
-- 文件路径约定：{user_id}/{filename}
-- ============================================

-- 允许登录用户上传图片（路径以自己 user_id 开头）
create policy "Users can upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'word-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许登录用户查看自己的图片
create policy "Users can view own images"
  on storage.objects for select
  using (
    bucket_id = 'word-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许登录用户删除自己的图片
create policy "Users can delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'word-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
