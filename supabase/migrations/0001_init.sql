create table if not exists public.catalogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text,
  delivery_address text,
  visit_date text,
  visit_date_to text,
  notes text,
  delivery_date text,
  pickup_date text,
  portfolio_date text,
  created_at timestamptz not null default now()
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text,
  delivery_address text,
  visit_date text,
  visit_date_to text,
  notes text,
  rooms int not null default 0,
  pieces jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  status text not null default 'pending',
  portfolio text,
  delivery_date text,
  pickup_date text,
  portfolio_date text,
  contract_date text,
  created_at timestamptz not null default now()
);

create table if not exists public.contracted_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text,
  delivery_address text,
  visit_date text,
  visit_date_to text,
  notes text,
  rooms int not null default 0,
  pieces jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  status text not null default 'contracted',
  portfolio text,
  delivery_date text,
  pickup_date text,
  portfolio_date text,
  contract_date text,
  finalized_at timestamptz not null default now()
);

create table if not exists public.non_contracted_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text,
  delivery_address text,
  visit_date text,
  visit_date_to text,
  notes text,
  rooms int not null default 0,
  pieces jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  status text not null default 'refused',
  portfolio text,
  delivery_date text,
  pickup_date text,
  portfolio_date text,
  contract_date text,
  finalized_at timestamptz not null default now()
);
