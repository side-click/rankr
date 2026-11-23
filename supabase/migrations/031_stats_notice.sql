-- Optional admin broadcast notice displayed at the top of all Stats Dashboards
alter table public.app_settings
  add column if not exists stats_notice text;
