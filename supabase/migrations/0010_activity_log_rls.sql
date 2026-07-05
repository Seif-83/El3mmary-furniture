alter table public.activity_logs enable row level security;

create policy "Enable all for authenticated users" on public.activity_logs
  for all using (auth.role() = 'authenticated');

grant all on public.activity_logs to authenticated;
