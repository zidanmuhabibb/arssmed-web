-- ARSSMED Web — skema inti (PRD §10).
-- Semua tabel: id uuid pk, created_at, RLS aktif (kebijakan di migrasi 0200).
-- Fungsi bantu & RPC di migrasi 0300.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Pengguna & organisasi
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 1 and 200),
  npsn text null check (npsn is null or npsn ~ '^[0-9]{8}$')
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  full_name text null check (full_name is null or length(full_name) <= 200),
  school_id uuid null references public.schools (id) on delete set null
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  school_id uuid null references public.schools (id) on delete set null,
  teacher_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (length(name) between 1 and 60),
  grade int not null default 6 check (grade between 1 and 12),
  academic_year text null check (academic_year is null or academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
  join_code text not null unique,
  mode text not null default 'learn_only' check (mode in ('research', 'learn_only')),
  -- Kolom PRD dipertahankan sebagai turunan agar tidak bisa bertentangan dengan `mode`.
  research_mode boolean generated always as (mode = 'research') stored
);
create index classes_teacher_idx on public.classes (teacher_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_code text not null check (student_code ~ '^[A-Z0-9-]{1,12}$'),
  nickname text null check (nickname is null or length(nickname) between 1 and 30),
  pin_hash text not null,
  pseudo_id text not null unique,
  -- Akun Supabase Auth milik siswa, dibuat saat pertama kali masuk (DECISIONS D-027).
  auth_user_id uuid null unique references auth.users (id) on delete set null,
  consent_status text not null default 'pending' check (consent_status in ('pending', 'granted', 'withdrawn')),
  consent_recorded_by uuid null references public.profiles (id) on delete set null,
  consent_recorded_at timestamptz null,
  withdrawn_at timestamptz null,
  unique (class_id, student_code)
);
create index students_class_idx on public.students (class_id);

-- Percobaan masuk siswa untuk pembatasan laju (PRD §10: 5 percobaan / 10 menit / kode siswa).
-- Disimpan per teks yang diketik (bukan id) agar tebakan kode kelas/siswa juga dibatasi.
create table public.student_login_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  join_code text not null,
  student_code text not null,
  succeeded boolean not null
);
create index student_login_attempts_key_idx on public.student_login_attempts (join_code, student_code, created_at desc);

-- ---------------------------------------------------------------------------
-- Konten belajar
-- ---------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique check (slug ~ '^u[0-9]+$'),
  title text not null,
  sort_order int not null,
  learning_objectives jsonb not null default '[]'::jsonb,
  intro text null
);

create table public.misconception_targets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  statement text not null,
  scientific_explanation text null,
  unit_id uuid null references public.units (id) on delete set null
);

create table public.ar_objects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unit_id uuid not null references public.units (id) on delete cascade,
  slug text not null,
  title text not null,
  glb_url text null,
  usdz_url text null,
  poster_url text null,
  sort_order int not null default 0,
  required boolean not null default true,
  license text null,
  attribution text null,
  source_url text null,
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'reviewed')),
  unique (unit_id, slug)
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ar_object_id uuid not null references public.ar_objects (id) on delete cascade,
  position jsonb not null,
  normal jsonb null,
  title text not null,
  body text not null,
  image_url text null,
  sort_order int not null default 0,
  source_ref text null
);

-- Bank soal "Tebak dulu" dan kuis latihan TERPISAH dari bank soal tes (PRD §4.2).
create table public.prediction_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unit_id uuid not null references public.units (id) on delete cascade,
  stem text not null,
  options jsonb not null,
  correct_key text not null,
  reveal_text text not null,
  misconception_code text null
);

create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unit_id uuid not null references public.units (id) on delete cascade,
  stem text not null,
  options jsonb not null,
  correct_key text not null,
  feedback text not null
);

-- ---------------------------------------------------------------------------
-- Asesmen
-- ---------------------------------------------------------------------------

create table public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rule_set_id text not null unique,           -- mis. 'pedoman-v1' (sama dengan data/rule-sets/*.json)
  name text not null,
  version int not null default 1,
  kind text not null check (kind in ('combined', 'per_tier')),
  rules jsonb not null,
  confidence_mode text null,
  incomplete_category text null check (incomplete_category is null or incomplete_category in ('SC', 'M', 'E', 'LK', 'LC')),
  created_by uuid null references public.profiles (id) on delete set null,
  is_default boolean not null default false
);
create unique index rule_sets_one_default on public.rule_sets (is_default) where is_default;

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  items_frozen boolean not null default false,
  rule_set_id uuid not null references public.rule_sets (id),
  created_by uuid null references public.profiles (id) on delete set null,
  unique (name, version)
);

create table public.test_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  test_id uuid not null references public.tests (id) on delete cascade,
  item_order int not null check (item_order >= 1),
  content jsonb not null,
  concept_domain text not null,
  report_domain text not null,
  misconception_code text null,
  fixed_order boolean not null default false,
  unique (test_id, item_order)
);

create table public.class_tests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  class_id uuid not null references public.classes (id) on delete cascade,
  test_id uuid not null references public.tests (id),
  phase text not null check (phase in ('pre', 'post')),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  opened_at timestamptz null,
  closed_at timestamptz null,
  unique (class_id, phase)
);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_test_id uuid not null references public.class_tests (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz null,
  device_kind text null check (device_kind is null or device_kind in ('android', 'ios', 'desktop', 'other')),
  user_agent_hash text null,
  unique (student_id, class_test_id)
);

create table public.item_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  attempt_id uuid not null references public.test_attempts (id) on delete cascade,
  item_id uuid not null references public.test_items (id) on delete cascade,
  tier1_key text null,
  reason_key text null,
  confidence_a int null check (confidence_a is null or confidence_a >= 0),
  confidence_r int null check (confidence_r is null or confidence_r >= 0),
  answered_at timestamptz not null default now(),
  client_timestamp timestamptz null,
  response_time_ms int null check (response_time_ms is null or response_time_ms >= 0),
  answer_changes int not null default 0,
  option_order jsonb null,
  unique (attempt_id, item_id)               -- idempotensi (PRD §12.5)
);

create table public.response_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_response_id uuid not null references public.item_responses (id) on delete cascade,
  field text not null,
  old_value text null,
  new_value text null,
  at timestamptz not null default now()
);

create table public.classifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_response_id uuid not null references public.item_responses (id) on delete cascade,
  rule_set_id uuid not null references public.rule_sets (id),
  a_correct boolean not null,
  r_correct boolean not null,
  confident boolean not null,
  confident_a boolean null,
  confident_r boolean null,
  category text not null check (category in ('SC', 'M', 'E', 'LK', 'LC')),
  computed_at timestamptz not null default now(),
  unique (item_response_id, rule_set_id)
);

-- ---------------------------------------------------------------------------
-- Aktivitas belajar
-- ---------------------------------------------------------------------------

create table public.unit_progress (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  step text not null check (step in ('tebak', 'amati', 'bandingkan', 'jelaskan')),
  completed_at timestamptz not null default now(),
  unique (student_id, unit_id, step)
);

create table public.prediction_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  prediction_item_id uuid not null references public.prediction_items (id) on delete cascade,
  selected_key text not null,
  answered_at timestamptz not null default now()
);

create table public.object_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  ar_object_id uuid not null references public.ar_objects (id) on delete cascade,
  mode text not null check (mode in ('3d', 'ar_surface', 'ar_marker')),
  duration_ms int null check (duration_ms is null or duration_ms >= 0),
  at timestamptz not null default now()
);

create table public.discussion_marks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit (tanpa data pribadi — PRD §10, §12.4)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid null,
  action text not null,
  entity text not null,
  entity_id uuid null,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- RLS aktif di SEMUA tabel public (PRD §9.2 prinsip 3). Tanpa kebijakan = tertutup.
-- Tidak memakai FORCE: fungsi SECURITY DEFINER milik pemilik tabel sengaja melewati RLS
-- dan melakukan pemeriksaan otorisasinya sendiri (migrasi 0300).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
