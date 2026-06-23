-- Migration 0005: Add furniture order management schema

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid unique,
  email text unique,
  username text,
  role text not null default 'viewer',
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phones text[] not null default array[]::text[],
  address text,
  governorate text,
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz,
  status text not null default 'pending',
  room_types text[] not null default array[]::text[],
  notes text,
  total_amount numeric not null default 0,
  contract_status text not null default 'not_contracted',
  portfolio_appointment_date timestamptz,
  pickup_date timestamptz,
  pickup_confirmed boolean not null default false,
  delivery_date timestamptz,
  delivery_confirmed boolean not null default false,
  contracted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.visit_rooms (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid references public.visits(id) on delete cascade,
  room_type text not null,
  aro_veneer boolean not null default false,
  room_subtotal numeric not null default 0
);

create table if not exists public.visit_room_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.visit_rooms(id) on delete cascade,
  item_name text not null,
  custom_item boolean not null default false,
  quantity int not null default 1,
  dimensions text,
  price numeric not null default 0,
  notes text,
  aro_veneer_addon boolean not null default false,
  aro_surcharge numeric not null default 0
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  type text not null,
  label text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  amount numeric not null default 0,
  paid_at timestamptz not null default now(),
  installment text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  type text not null,
  message text not null,
  success boolean not null default false,
  details jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.production_stages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  stage text not null,
  status text not null default 'not_started',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
