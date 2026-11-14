-- Allow users to arrange teams and save drafts even when an edition is locked;
-- locking an edition only prevents publishing.

drop policy if exists "Users can insert own ballots" on public.ballots;
create policy "Users can insert own ballots"
  on public.ballots for insert
  with check (
    auth.uid() = user_id
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Users can update own ballots when edition is open" on public.ballots;
create policy "Users can update own ballots when edition is open"
  on public.ballots for update
  using (
    auth.uid() = user_id
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      status = 'draft'
      or exists (
        select 1 from public.editions e
        where e.id = edition_id and e.is_open = true
      )
    )
  );

drop policy if exists "Users can update entries for own open ballots" on public.ballot_entries;
create policy "Users can update entries for own open ballots"
  on public.ballot_entries for update
  using (
    exists (
      select 1 from public.ballots b
      left join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and (b.status = 'draft' or e.is_open = true)
    )
  );

drop policy if exists "Users can delete entries for own open ballots" on public.ballot_entries;
create policy "Users can delete entries for own open ballots"
  on public.ballot_entries for delete
  using (
    exists (
      select 1 from public.ballots b
      left join public.editions e on e.id = b.edition_id
      where b.id = ballot_id
        and b.user_id = auth.uid()
        and (b.status = 'draft' or e.is_open = true)
    )
  );
