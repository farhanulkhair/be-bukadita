-- Bukadita Backend Database Schema
-- Execute this script in Supabase SQL Editor

-- Enable required extensions
create extension if not exists "pgcrypto";

-- =============================================================================
-- TABLES
-- =============================================================================

-- Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'pengguna' check (role in ('pengguna','admin')),
  created_at timestamptz default now()
);

-- Posyandu schedules
create table if not exists posyandu_schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  date timestamptz not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Materials/Articles
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text not null,
  author uuid references profiles(id) on delete set null,
  published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quizzes
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  material_id uuid references materials(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Quiz questions
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  question text not null,
  created_at timestamptz default now()
);

-- Quiz answer choices
create table if not exists quiz_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references quiz_questions(id) on delete cascade,
  choice_text text not null,
  is_correct boolean default false
);

-- Quiz results/submissions
create table if not exists quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  score numeric check (score >= 0 and score <= 100),
  taken_at timestamptz default now(),
  unique(quiz_id, user_id) -- Prevent duplicate submissions per user per quiz
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Profiles indexes
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_created_at on profiles(created_at);

-- Schedules indexes
create index if not exists idx_schedules_date on posyandu_schedules(date);
create index if not exists idx_schedules_created_by on posyandu_schedules(created_by);

-- Materials indexes
create index if not exists idx_materials_published on materials(published);
create index if not exists idx_materials_author on materials(author);
create index if not exists idx_materials_created_at on materials(created_at);
create index if not exists idx_materials_slug on materials(slug);

-- Quizzes indexes
create index if not exists idx_quizzes_material_id on quizzes(material_id);
create index if not exists idx_quizzes_created_by on quizzes(created_by);

-- Quiz questions indexes
create index if not exists idx_quiz_questions_quiz_id on quiz_questions(quiz_id);

-- Quiz choices indexes
create index if not exists idx_quiz_choices_question_id on quiz_choices(question_id);
create index if not exists idx_quiz_choices_correct on quiz_choices(is_correct) where is_correct = true;

-- Quiz results indexes
create index if not exists idx_quiz_results_user_id on quiz_results(user_id);
create index if not exists idx_quiz_results_quiz_id on quiz_results(quiz_id);
create index if not exists idx_quiz_results_taken_at on quiz_results(taken_at);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table posyandu_schedules enable row level security;
alter table materials enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_choices enable row level security;
alter table quiz_results enable row level security;

-- Profiles policies
create policy "profiles_select_own_or_admin" on profiles for select
using (
  auth.role() = 'authenticated' AND (
    auth.uid() = id OR 
    exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
);

create policy "profiles_update_own" on profiles for update
using (auth.uid() = id);

create policy "profiles_insert_own" on profiles for insert
with check (auth.uid() = id);

-- Posyandu schedules policies (public read, admin write)
create policy "schedules_public_select" on posyandu_schedules for select
using (true);

create policy "schedules_admin_insert" on posyandu_schedules for insert
with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "schedules_admin_update" on posyandu_schedules for update
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "schedules_admin_delete" on posyandu_schedules for delete
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Materials policies
create policy "materials_published_select" on materials for select
using (
  published = true OR 
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "materials_admin_insert" on materials for insert
with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "materials_admin_update" on materials for update
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "materials_admin_delete" on materials for delete
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Quizzes policies
create policy "quizzes_authenticated_select" on quizzes for select
using (auth.role() = 'authenticated');

create policy "quizzes_admin_insert" on quizzes for insert
with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quizzes_admin_update" on quizzes for update
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quizzes_admin_delete" on quizzes for delete
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Quiz questions policies
create policy "quiz_questions_authenticated_select" on quiz_questions for select
using (auth.role() = 'authenticated');

create policy "quiz_questions_admin_insert" on quiz_questions for insert
with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quiz_questions_admin_update" on quiz_questions for update
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quiz_questions_admin_delete" on quiz_questions for delete
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Quiz choices policies
create policy "quiz_choices_authenticated_select" on quiz_choices for select
using (auth.role() = 'authenticated');

create policy "quiz_choices_admin_insert" on quiz_choices for insert
with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quiz_choices_admin_update" on quiz_choices for update
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quiz_choices_admin_delete" on quiz_choices for delete
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Quiz results policies
create policy "quiz_results_insert_own" on quiz_results for insert
with check (auth.uid() = user_id);

create policy "quiz_results_select_own_or_admin" on quiz_results for select
using (
  auth.uid() = user_id OR 
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quiz_results_admin_update" on quiz_results for update
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "quiz_results_admin_delete" on quiz_results for delete
using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for materials table
create trigger update_materials_updated_at
  before update on materials
  for each row execute function update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Uncomment the following lines if you want to insert sample data for testing

-- Insert sample admin user profile (replace with actual admin user ID from auth.users)
-- INSERT INTO profiles (id, full_name, phone, role) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'Admin User', '+628123456789', 'admin')
-- ON CONFLICT (id) DO NOTHING;

-- Insert sample schedule
-- INSERT INTO posyandu_schedules (title, description, location, date, created_by)
-- VALUES (
--   'Posyandu Rutin Bulan Januari',
--   'Pemeriksaan kesehatan rutin untuk ibu dan anak',
--   'Balai Desa Sukamaju',
--   '2024-01-15 09:00:00+07',
--   '00000000-0000-0000-0000-000000000000'
-- );

-- Insert sample material
-- INSERT INTO materials (title, slug, content, author, published)
-- VALUES (
--   'Tips Nutrisi untuk Ibu Hamil',
--   'tips-nutrisi-ibu-hamil',
--   'Artikel mengenai nutrisi yang dibutuhkan ibu hamil untuk kesehatan optimal.',
--   '00000000-0000-0000-0000-000000000000',
--   true
-- );

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Run these queries after execution to verify the setup:

-- Check if all tables are created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
-- SELECT schemaname, tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public';

-- =============================================================================

-- Schema creation completed successfully!
-- Remember to:
-- 1. Replace sample UUIDs with actual user IDs from auth.users
-- 2. Configure Supabase Auth settings for Google OAuth
-- 3. Set up your frontend redirect URLs in Supabase Auth settings
-- 4. Update CORS origins in your backend configuration