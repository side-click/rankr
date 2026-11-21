-- Custom admin-managed allowlist, blocklist, and soft-flag rules

create table if not exists public.moderation_rules (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  rule_type text not null check (rule_type in ('allow', 'block', 'flag')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists moderation_rules_term_type_idx
  on public.moderation_rules (lower(term), rule_type);

alter table public.moderation_rules enable row level security;

drop policy if exists "Admins can manage moderation rules" on public.moderation_rules;
create policy "Admins can manage moderation rules"
  on public.moderation_rules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
