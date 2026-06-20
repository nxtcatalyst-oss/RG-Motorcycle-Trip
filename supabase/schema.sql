create extension if not exists pgcrypto;

create table if not exists public.trip_documents (
  slug text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Summer Motorcycle Trip',
  dates text default '',
  riders text default '',
  start_location text default '',
  destination text default '',
  planning_status text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sort_order integer not null default 0,
  title text not null default '',
  ride_date date,
  start_location text default '',
  end_location text default '',
  miles numeric not null default 0,
  hours numeric not null default 0,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  route_day_id uuid references public.route_days(id) on delete set null,
  day_number integer,
  name text not null default '',
  category text not null default 'other',
  area text default '',
  priority text default 'good option',
  status text default 'considering',
  estimated_cost numeric not null default 0,
  link text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bikes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  rider text not null default '',
  bike text default '',
  tank_gallons numeric not null default 0,
  mpg numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  fuel_date date,
  rider text default '',
  location text default '',
  gallons numeric not null default 0,
  price_per_gallon numeric not null default 0,
  odometer numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  description text not null default '',
  category text not null default 'misc',
  estimated numeric not null default 0,
  actual numeric not null default 0,
  paid_by text default '',
  split text default 'group',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_group text not null default 'Packing',
  text text not null default '',
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_trips_updated_at on public.trips;
create trigger touch_trips_updated_at
before update on public.trips
for each row execute function public.touch_updated_at();

drop trigger if exists touch_route_days_updated_at on public.route_days;
create trigger touch_route_days_updated_at
before update on public.route_days
for each row execute function public.touch_updated_at();

drop trigger if exists touch_stops_updated_at on public.stops;
create trigger touch_stops_updated_at
before update on public.stops
for each row execute function public.touch_updated_at();

drop trigger if exists touch_bikes_updated_at on public.bikes;
create trigger touch_bikes_updated_at
before update on public.bikes
for each row execute function public.touch_updated_at();

drop trigger if exists touch_fuel_logs_updated_at on public.fuel_logs;
create trigger touch_fuel_logs_updated_at
before update on public.fuel_logs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_expenses_updated_at on public.expenses;
create trigger touch_expenses_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

drop trigger if exists touch_checklist_items_updated_at on public.checklist_items;
create trigger touch_checklist_items_updated_at
before update on public.checklist_items
for each row execute function public.touch_updated_at();

drop trigger if exists touch_notes_updated_at on public.notes;
create trigger touch_notes_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

drop trigger if exists touch_trip_documents_updated_at on public.trip_documents;
create trigger touch_trip_documents_updated_at
before update on public.trip_documents
for each row execute function public.touch_updated_at();

alter table public.trip_documents enable row level security;
alter table public.trips enable row level security;
alter table public.route_days enable row level security;
alter table public.stops enable row level security;
alter table public.bikes enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.expenses enable row level security;
alter table public.checklist_items enable row level security;
alter table public.notes enable row level security;

drop policy if exists "Public trip document planning access" on public.trip_documents;
create policy "Public trip document planning access"
on public.trip_documents for all
using (true)
with check (true);

drop policy if exists "Public trip planning access" on public.trips;
create policy "Public trip planning access"
on public.trips for all
using (true)
with check (true);

drop policy if exists "Public route day planning access" on public.route_days;
create policy "Public route day planning access"
on public.route_days for all
using (true)
with check (true);

drop policy if exists "Public stop planning access" on public.stops;
create policy "Public stop planning access"
on public.stops for all
using (true)
with check (true);

drop policy if exists "Public bike planning access" on public.bikes;
create policy "Public bike planning access"
on public.bikes for all
using (true)
with check (true);

drop policy if exists "Public fuel planning access" on public.fuel_logs;
create policy "Public fuel planning access"
on public.fuel_logs for all
using (true)
with check (true);

drop policy if exists "Public expense planning access" on public.expenses;
create policy "Public expense planning access"
on public.expenses for all
using (true)
with check (true);

drop policy if exists "Public checklist planning access" on public.checklist_items;
create policy "Public checklist planning access"
on public.checklist_items for all
using (true)
with check (true);

drop policy if exists "Public notes planning access" on public.notes;
create policy "Public notes planning access"
on public.notes for all
using (true)
with check (true);
