

-- PHASE 2 (FINAL) — create extension, tables, indexes, functions, triggers, and RLS policies
-- IMPORTANT: BACKUP your DB before running this script.

-- --------------------
-- 0) extension
-- --------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------
-- 1) roles (static)
-- --------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,    -- 'superadmin','admin','pengguna'
  description text
);

INSERT INTO public.roles (name, description)
VALUES
  ('superadmin','Super Administrator'),
  ('admin','Admin biasa'),
  ('pengguna','Pengguna / Kader')
ON CONFLICT (name) DO NOTHING;

-- --------------------
-- 2) profiles (linked to auth.users) — NO DEFAULT subquery
-- --------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  role_id integer REFERENCES public.roles(id),
  avatar_url text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger function to set default role_id if not provided
CREATE OR REPLACE FUNCTION public.set_default_role_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    SELECT id INTO NEW.role_id FROM public.roles WHERE name = 'pengguna' LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_default_role ON public.profiles;
CREATE TRIGGER trg_set_default_role
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_role_id();

-- --------------------
-- 3) posyandu locations & schedules
-- --------------------
CREATE TABLE IF NOT EXISTS public.posyandu_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  contact text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.posyandu_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.posyandu_locations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- --------------------
-- 4) materials and related
-- --------------------
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  content text NOT NULL,
  author uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.materials(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  position integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.material_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.materials(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text,
  caption text
);

-- --------------------
-- 5) quizzes / questions / choices
-- --------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.materials(id) ON DELETE CASCADE,
  title text,
  description text,
  passing_score integer,
  time_limit_seconds integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text DEFAULT 'mcq',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  choice_text text NOT NULL,
  is_correct boolean DEFAULT false,
  position integer DEFAULT 0
);

-- --------------------
-- 6) quiz attempts & answers
-- --------------------
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  score numeric CHECK (score >= 0 AND score <= 100),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  status text DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  choice_id uuid REFERENCES public.quiz_choices(id),
  text_answer text,
  is_correct boolean,
  answered_at timestamptz DEFAULT now()
);

-- --------------------
-- 7) invitations & activity logs
-- --------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  role_id integer REFERENCES public.roles(id),
  token text NOT NULL,
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_table text,
  target_id text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- --------------------
-- 8) indexes
-- --------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_materials_slug ON public.materials(slug);
CREATE INDEX IF NOT EXISTS idx_materials_published ON public.materials(published);
CREATE INDEX IF NOT EXISTS idx_materials_author ON public.materials(author);
CREATE INDEX IF NOT EXISTS idx_quizzes_material_id ON public.quizzes(material_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_choices_question_id ON public.quiz_choices(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_posyandu_schedules_loc ON public.posyandu_schedules(location_id);
CREATE INDEX IF NOT EXISTS idx_posyandu_schedules_start ON public.posyandu_schedules(start_at);

-- --------------------
-- 9) helper functions & triggers
-- --------------------
-- updated_at helper for materials (and can be reused)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_materials_updated_at ON public.materials;
CREATE TRIGGER trg_update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create/update profile when auth.users row is created/updated
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.email,
    (SELECT id FROM public.roles WHERE name = 'pengguna' LIMIT 1)
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = COALESCE(NULLIF(EXCLUDED.phone,''), public.profiles.phone),
        email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- helper to check admin from JWT claim
CREATE OR REPLACE FUNCTION public.is_adminish()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','superadmin'), false);
$$;

-- --------------------
-- 10) enable RLS on needed tables
-- --------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posyandu_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posyandu_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- --------------------
-- 11) DROP old policies (if any)
-- --------------------
-- profiles
DROP POLICY IF EXISTS profiles_select_owner_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_owner ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_owner_or_admin ON public.profiles;

-- materials
DROP POLICY IF EXISTS materials_select_public ON public.materials;
DROP POLICY IF EXISTS materials_insert_admin ON public.materials;
DROP POLICY IF EXISTS materials_update_admin_or_author ON public.materials;
DROP POLICY IF EXISTS materials_delete_admin ON public.materials;

-- posyandu
DROP POLICY IF EXISTS posyandu_locations_select_public ON public.posyandu_locations;
DROP POLICY IF EXISTS posyandu_locations_crud_admin ON public.posyandu_locations;
DROP POLICY IF EXISTS posyandu_schedules_select_public ON public.posyandu_schedules;
DROP POLICY IF EXISTS posyandu_schedules_insert_admin ON public.posyandu_schedules;
DROP POLICY IF EXISTS posyandu_schedules_update_admin ON public.posyandu_schedules;
DROP POLICY IF EXISTS posyandu_schedules_delete_admin ON public.posyandu_schedules;

-- quizzes
DROP POLICY IF EXISTS quizzes_select_public ON public.quizzes;
DROP POLICY IF EXISTS quizzes_crud_admin ON public.quizzes;
DROP POLICY IF EXISTS quiz_questions_select ON public.quiz_questions;
DROP POLICY IF EXISTS quiz_choices_select ON public.quiz_choices;

-- quiz attempts & answers
DROP POLICY IF EXISTS quiz_attempts_insert_owner ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_select_owner_admin ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_update_owner ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_answers_insert_owner ON public.quiz_answers;
DROP POLICY IF EXISTS quiz_answers_select_owner_admin ON public.quiz_answers;

-- invitations & activity logs
DROP POLICY IF EXISTS invitations_insert_admin ON public.invitations;
DROP POLICY IF EXISTS invitations_select_admin_or_email ON public.invitations;
DROP POLICY IF EXISTS activity_logs_admin_only ON public.activity_logs;

-- --------------------
-- 12) CREATE policies (explicit, correct syntax)
-- --------------------

-- PROFILES
CREATE POLICY profiles_select_owner_or_admin
  ON public.profiles
  FOR SELECT
  USING ( auth.uid() = id OR public.is_adminish() );

CREATE POLICY profiles_insert_self
  ON public.profiles
  FOR INSERT
  WITH CHECK ( auth.uid() = id AND role_id = (SELECT id FROM public.roles WHERE name = 'pengguna' LIMIT 1) );

CREATE POLICY profiles_update_owner
  ON public.profiles
  FOR UPDATE
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

CREATE POLICY profiles_update_admin
  ON public.profiles
  FOR UPDATE
  USING ( public.is_adminish() )
  WITH CHECK ( public.is_adminish() );

CREATE POLICY profiles_delete_owner_or_admin
  ON public.profiles
  FOR DELETE
  USING ( auth.uid() = id OR public.is_adminish() );

-- MATERIALS
CREATE POLICY materials_select_public
  ON public.materials
  FOR SELECT
  USING ( published = true OR public.is_adminish() OR author = auth.uid() );

CREATE POLICY materials_insert_admin
  ON public.materials
  FOR INSERT
  WITH CHECK ( public.is_adminish() );

CREATE POLICY materials_update_admin_or_author
  ON public.materials
  FOR UPDATE
  USING ( public.is_adminish() OR author = auth.uid() )
  WITH CHECK ( public.is_adminish() OR author = auth.uid() );

CREATE POLICY materials_delete_admin
  ON public.materials
  FOR DELETE
  USING ( public.is_adminish() );

-- POSYANDU LOCATIONS & SCHEDULES
CREATE POLICY posyandu_locations_select_public
  ON public.posyandu_locations
  FOR SELECT
  USING ( true );

CREATE POLICY posyandu_locations_crud_admin
  ON public.posyandu_locations
  FOR ALL
  USING ( public.is_adminish() )
  WITH CHECK ( public.is_adminish() );

CREATE POLICY posyandu_schedules_select_public
  ON public.posyandu_schedules
  FOR SELECT
  USING ( true );

CREATE POLICY posyandu_schedules_insert_admin
  ON public.posyandu_schedules
  FOR INSERT
  WITH CHECK ( public.is_adminish() );

CREATE POLICY posyandu_schedules_update_admin
  ON public.posyandu_schedules
  FOR UPDATE
  USING ( public.is_adminish() )
  WITH CHECK ( public.is_adminish() );

CREATE POLICY posyandu_schedules_delete_admin
  ON public.posyandu_schedules
  FOR DELETE
  USING ( public.is_adminish() );

-- QUIZZES / QUESTIONS / CHOICES
CREATE POLICY quizzes_select_public
  ON public.quizzes
  FOR SELECT
  USING (
    public.is_adminish()
    OR (
      material_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.materials m WHERE m.id = public.quizzes.material_id AND m.published = true
      )
    )
  );

CREATE POLICY quizzes_crud_admin
  ON public.quizzes
  FOR ALL
  USING ( public.is_adminish() )
  WITH CHECK ( public.is_adminish() );

CREATE POLICY quiz_questions_select
  ON public.quiz_questions
  FOR SELECT
  USING (
    public.is_adminish()
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = public.quiz_questions.quiz_id
        AND q.material_id IN (SELECT id FROM public.materials WHERE published = true)
    )
  );

CREATE POLICY quiz_choices_select
  ON public.quiz_choices
  FOR SELECT
  USING ( public.is_adminish() );

-- QUIZ ATTEMPTS & ANSWERS
CREATE POLICY quiz_attempts_insert_owner
  ON public.quiz_attempts
  FOR INSERT
  WITH CHECK ( auth.uid() IS NOT NULL AND user_id = auth.uid() );

CREATE POLICY quiz_attempts_select_owner_admin
  ON public.quiz_attempts
  FOR SELECT
  USING ( user_id = auth.uid() OR public.is_adminish() );

CREATE POLICY quiz_attempts_update_owner
  ON public.quiz_attempts
  FOR UPDATE
  USING ( user_id = auth.uid() OR public.is_adminish() )
  WITH CHECK ( user_id = auth.uid() OR public.is_adminish() );

CREATE POLICY quiz_answers_insert_owner
  ON public.quiz_answers
  FOR INSERT
  WITH CHECK ( auth.uid() IS NOT NULL );

CREATE POLICY quiz_answers_select_owner_admin
  ON public.quiz_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts a
      WHERE a.id = public.quiz_answers.attempt_id
        AND (a.user_id = auth.uid() OR public.is_adminish())
    )
  );

-- INVITATIONS
CREATE POLICY invitations_insert_admin
  ON public.invitations
  FOR INSERT
  WITH CHECK ( public.is_adminish() );

CREATE POLICY invitations_select_admin_or_email
  ON public.invitations
  FOR SELECT
  USING ( public.is_adminish() OR (auth.uid() IS NOT NULL AND auth.jwt() ->> 'email' = email) );

-- ACTIVITY LOGS
CREATE POLICY activity_logs_admin_only
  ON public.activity_logs
  FOR ALL
  USING ( public.is_adminish() )
  WITH CHECK ( public.is_adminish() );

-- --------------------
-- End PHASE 2
-- --------------------
