-- Distinguish past/archived editions (completely read-only, no drafts) from locked upcoming editions (drafts allowed)

alter table public.editions
  add column if not exists is_archived boolean not null default false;

-- Enforce non-archived editions on ballot and ballot_entry writes
drop policy if exists "Users can insert own ballots" on public.ballots;
create policy "Users can insert own ballots"
  on public.ballots for insert
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (status = 'draft' or e.is_open = true)
    )
  );

drop policy if exists "Users can update own ballots when edition is open" on public.ballots;
create policy "Users can update own ballots when edition is open"
  on public.ballots for update
  using (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (status = 'draft' or e.is_open = true)
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.editions e
      where e.id = edition_id
        and e.is_archived = false
        and (status = 'draft' or e.is_open = true)
    )
  );

drop policy if exists "Users can insert entries for own ballots" on public.ballot_entries;
create policy "Users can insert entries for own ballots"
  on public.ballot_entries for insert
  with check (
    public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.ballots b
      join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and e.is_archived = false
    )
  );

drop policy if exists "Users can update entries for own open ballots" on public.ballot_entries;
create policy "Users can update entries for own open ballots"
  on public.ballot_entries for update
  using (
    public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.ballots b
      join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and e.is_archived = false
        and (b.status = 'draft' or e.is_open = true)
    )
  );

drop policy if exists "Users can delete entries for own open ballots" on public.ballot_entries;
create policy "Users can delete entries for own open ballots"
  on public.ballot_entries for delete
  using (
    public.is_not_banned()
    and public.is_app_enabled()
    and public.is_allowlisted()
    and exists (
      select 1 from public.ballots b
      join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and e.is_archived = false
        and (b.status = 'draft' or e.is_open = true)
    )
  );
