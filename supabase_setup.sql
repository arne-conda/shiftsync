-- ShiftSync / SalaryBridge database setup
-- Run this in Supabase SQL Editor

-- 1. Employer mappings: normalized full name -> lønnstakernr
create table if not exists employer_mappings (
    id bigint generated always as identity primary key,
    normalized_name text not null unique,
    lonnstakernr text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Salary type mappings: quinyx code -> tripletex lønnsart
create table if not exists salary_type_mappings (
    id bigint generated always as identity primary key,
    employee_type text not null check (employee_type in ('driver', 'warehouse')),
    source_code text not null,        -- Quinyx salary type code (e.g. "1234")
    target_loennsart text not null,   -- Tripletex lønnsart code
    rate text,                        -- Sats (optional)
    comment text,                     -- Kommentar (optional)
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (employee_type, source_code, target_loennsart)
);

-- Index for fast lookups
create index if not exists idx_employer_mappings_name on employer_mappings(normalized_name);
create index if not exists idx_salary_type_mappings_lookup on salary_type_mappings(employee_type, source_code);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger employer_mappings_updated_at
    before update on employer_mappings
    for each row execute function update_updated_at();

create trigger salary_type_mappings_updated_at
    before update on salary_type_mappings
    for each row execute function update_updated_at();

-- Enable Row Level Security (allow all for now - add auth later if needed)
alter table employer_mappings enable row level security;
alter table salary_type_mappings enable row level security;

create policy "Allow all" on employer_mappings for all using (true) with check (true);
create policy "Allow all" on salary_type_mappings for all using (true) with check (true);
