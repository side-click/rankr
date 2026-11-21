-- Simple Blogs publishing platform + blog-media storage bucket

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_name text,
  title text not null,
  subtitle text,
  banner_url text,
  content text not null default '',
  season_id uuid references public.seasons(id) on delete set null,
  season_name_snapshot text,
  league_name_snapshot text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blogs_status_published_at_idx
  on public.blogs (status, published_at desc);

create index if not exists blogs_season_status_published_at_idx
  on public.blogs (season_id, status, published_at desc);

create index if not exists blogs_user_updated_at_idx
  on public.blogs (user_id, updated_at desc);

alter table public.blogs enable row level security;

drop policy if exists "Published blogs are publicly readable" on public.blogs;
create policy "Published blogs are publicly readable"
  on public.blogs for select
  using (
    status = 'published'
    or auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "Allowlisted users can insert own blogs" on public.blogs;
create policy "Allowlisted users can insert own blogs"
  on public.blogs for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
  );

drop policy if exists "Allowlisted users can update own blogs" on public.blogs;
create policy "Allowlisted users can update own blogs"
  on public.blogs for update
  to authenticated
  using (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
      and public.is_allowlisted()
    )
    or public.is_admin()
  )
  with check (
    (
      auth.uid() = user_id
      and public.is_not_banned()
      and public.is_app_enabled()
      and public.is_allowlisted()
    )
    or public.is_admin()
  );

drop policy if exists "Users or admins can delete blogs" on public.blogs;
create policy "Users or admins can delete blogs"
  on public.blogs for delete
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin()
  );

-- Storage bucket for blog banners & inline images/GIFs (5 MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-media',
  'blog-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Blog media is publicly readable" on storage.objects;
create policy "Blog media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'blog-media');

drop policy if exists "Allowlisted users can upload own blog media" on storage.objects;
create policy "Allowlisted users can upload own blog media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blog-media'
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users or admins can delete blog media" on storage.objects;
create policy "Users or admins can delete blog media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'blog-media'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
