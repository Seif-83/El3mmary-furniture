alter table if exists public.inspections
  drop constraint if exists inspections_status_check;

alter table if exists public.inspections
  alter column status set default 'pending';

alter table if exists public.inspections
  add constraint inspections_status_check
  check (
    status = any (array['pending'::text, 'scheduled'::text, 'done'::text, 'no_contract'::text])
  );
