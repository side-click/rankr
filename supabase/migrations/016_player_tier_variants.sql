-- Allow up to 4 independent Player Tier Lists per user/edition/division
-- (standard_overall, standard_split, draft_day_overall, draft_day_split)

alter table public.ballots
  add column if not exists tier_variant text
  check (
    tier_variant is null
    or tier_variant in (
      'standard_overall',
      'standard_split',
      'draft_day_overall',
      'draft_day_split'
    )
  );

update public.ballots
set tier_variant = case
  when coalesce(tier_data->>'preset', 'standard') = 'draft_day'
    and coalesce((tier_data->>'splitByRole')::boolean, false)
    then 'draft_day_split'
  when coalesce(tier_data->>'preset', 'standard') = 'draft_day'
    then 'draft_day_overall'
  when coalesce((tier_data->>'splitByRole')::boolean, false)
    then 'standard_split'
  else 'standard_overall'
end
where ranking_type = 'player'
  and tier_variant is null;

drop index if exists public.ballots_user_scope_unique;

create unique index ballots_user_scope_unique
  on public.ballots (
    user_id,
    season_id,
    coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid),
    edition_id,
    ranking_type,
    coalesce(tier_variant, '')
  )
  where season_id is not null and edition_id is not null;
