-- Customizable division themes (colors + default logo)

create table if not exists public.division_themes (
  key text primary key,
  name text not null,
  primary_color text not null default '#6b2d8b',
  secondary_color text not null default '#00b8c9',
  accent_text_color text not null default '#c77dff',
  default_logo_url text,
  created_at timestamptz not null default now()
);

alter table public.division_themes enable row level security;

drop policy if exists "Division themes are publicly readable" on public.division_themes;
create policy "Division themes are publicly readable"
  on public.division_themes for select using (true);

drop policy if exists "Admins can manage division themes" on public.division_themes;
create policy "Admins can manage division themes"
  on public.division_themes for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.division_themes (key, name, primary_color, secondary_color, accent_text_color, default_logo_url)
values
  ('baron', 'Baron Theme', '#6b2d8b', '#00b8c9', '#c77dff', '/images/SCDL Logos/Baron.png'),
  ('dragon', 'Dragon Theme', '#e84a1b', '#3b1c4a', '#ff8a5c', '/images/SCDL Logos/Dragon.png')
on conflict (key) do nothing;
