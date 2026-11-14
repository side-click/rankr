-- ============================================================
-- 007: Convert existing teams.roster string arrays to structured
-- [{ role, name, is_captain }] format (top, jungle, mid, bot, support)
-- ============================================================

update public.teams t
set roster = (
  select jsonb_agg(
    jsonb_build_object(
      'role',
      case ord
        when 1 then 'top'
        when 2 then 'jungle'
        when 3 then 'mid'
        when 4 then 'bot'
        else 'support'
      end,
      'name',
      elem,
      'is_captain',
      (
        t.captain is not null
        and t.captain <> ''
        and lower(replace(elem, ' ', '')) like lower(replace(t.captain, ' ', '')) || '%'
      )
    )
    order by ord
  )
  from jsonb_array_elements_text(t.roster) with ordinality as arr(elem, ord)
)
where jsonb_typeof(t.roster) = 'array'
  and jsonb_array_length(t.roster) > 0
  and jsonb_typeof(t.roster->0) = 'string';
