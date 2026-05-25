-- Deprecated legacy schema. The active application stores diagnoses in Cloud Firestore.
create extension if not exists "pgcrypto";

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_codes_email_created_idx
on public.email_verification_codes (email, created_at desc);

create unique index if not exists email_verification_codes_one_active_idx
on public.email_verification_codes (email)
where used = false;

alter table public.email_verification_codes enable row level security;

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  image_url text null,
  image_name text null,
  season_type text not null check (season_type in ('spring', 'summer', 'autumn', 'winter')),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  lab_features jsonb not null default '{}'::jsonb,
  color_palette jsonb not null default '[]'::jsonb,
  style_keywords text[] not null default '{}',
  ai_description text not null default '',
  scores jsonb null
);

create index if not exists diagnoses_created_at_idx on public.diagnoses (created_at desc);
create index if not exists diagnoses_user_id_idx on public.diagnoses (user_id);

alter table public.diagnoses enable row level security;

drop policy if exists "diagnoses_select_own_or_anonymous" on public.diagnoses;
create policy "diagnoses_select_own_or_anonymous"
on public.diagnoses
for select
using (user_id is null or auth.uid() = user_id);

drop policy if exists "diagnoses_insert_own_or_anonymous" on public.diagnoses;
create policy "diagnoses_insert_own_or_anonymous"
on public.diagnoses
for insert
with check (user_id is null or auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diagnosis-images',
  'diagnosis-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
