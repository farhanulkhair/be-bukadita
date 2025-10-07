-- Enable uuid generator (pgcrypto)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------
-- Table: roles
-- -------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text
);

-- Seed roles (run once)
INSERT INTO public.roles (name, description)
VALUES
  ('superadmin','Super administrator - bisa membuat admin'),
  ('admin','Administrator - input modul/materi/kuis'),
  ('pengguna','Kader / pengguna biasa')
ON CONFLICT (name) DO NOTHING;

-- -------------------------
-- Table: modules
-- -------------------------
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  duration_label text,
  duration_minutes integer CHECK (duration_minutes >= 0),
  lessons integer DEFAULT 0 CHECK (lessons >= 0),
  difficulty text,
  category text,
  rating numeric DEFAULT 0 CHECK (rating >= 0),
  students integer DEFAULT 0 CHECK (students >= 0),
  estimated_completion_label text,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT fk_modules_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_modules_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_modules_category ON public.modules (category);
CREATE INDEX IF NOT EXISTS idx_modules_published ON public.modules (published);

-- -------------------------
-- Table: sub_materis
-- -------------------------
CREATE TABLE IF NOT EXISTS public.sub_materis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  title text NOT NULL,
  order_index integer DEFAULT 0,
  content text NOT NULL,
  published boolean DEFAULT false,
  slug text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT fk_submateris_module FOREIGN KEY (module_id) REFERENCES public.modules (id) ON DELETE CASCADE,
  CONSTRAINT fk_submateris_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_submateris_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_submateri_module_id ON public.sub_materis (module_id);
CREATE INDEX IF NOT EXISTS idx_submateri_module_order ON public.sub_materis (module_id, order_index);

-- -------------------------
-- Table: poin_details
-- -------------------------
CREATE TABLE IF NOT EXISTS public.poin_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_materi_id uuid NOT NULL,
  title text NOT NULL,
  content_html text,
  type text DEFAULT 'text',           -- 'text' | 'video' | 'image' etc.
  duration_label text,
  duration_minutes integer CHECK (duration_minutes >= 0),
  video_url text,
  image_url text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT fk_poin_sub FOREIGN KEY (sub_materi_id) REFERENCES public.sub_materis (id) ON DELETE CASCADE,
  CONSTRAINT fk_poin_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_poin_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_poin_sub ON public.poin_details (sub_materi_id);
CREATE INDEX IF NOT EXISTS idx_poin_order ON public.poin_details (sub_materi_id, order_index);

-- -------------------------
-- Table: materis_quizzes
-- -------------------------
CREATE TABLE IF NOT EXISTS public.materis_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  sub_materi_id uuid NOT NULL,        -- quiz terkait pada poin terakhir / sub materi
  quiz_type text DEFAULT 'sub',      -- 'sub' atau 'module' (kamu sebut permateri)
  title text,
  description text,
  time_limit_seconds integer DEFAULT 600 CHECK (time_limit_seconds > 0), -- default 10 menit
  passing_score integer DEFAULT 70 CHECK (passing_score >= 0 AND passing_score <= 100),
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  CONSTRAINT fk_quiz_module FOREIGN KEY (module_id) REFERENCES public.modules (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_sub FOREIGN KEY (sub_materi_id) REFERENCES public.sub_materis (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_quiz_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_module ON public.materis_quizzes (module_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sub ON public.materis_quizzes (sub_materi_id);

-- -------------------------
-- Table: materis_quiz_questions
-- (options stored as jsonb - opsi A)
-- -------------------------
CREATE TABLE IF NOT EXISTS public.materis_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,      -- e.g. ['a','b','c','d']
  correct_answer_index integer NOT NULL,  -- index into options (0-based)
  explanation text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES public.materis_quizzes (id) ON DELETE CASCADE,
  CONSTRAINT ck_correct_index_nonneg CHECK (correct_answer_index >= 0)
);

-- -------------------------
-- Table: user_quiz_attempts
-- -------------------------
CREATE TABLE IF NOT EXISTS public.user_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score numeric CHECK (score >= 0 AND score <= 100),
  total_questions integer,
  correct_answers integer,
  passed boolean DEFAULT false,
  answers jsonb,                -- store array of answers with question_id and selected_index
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES public.materis_quizzes (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempt_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_quiz_user ON public.user_quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_quiz_quiz ON public.user_quiz_attempts (quiz_id);

-- -------------------------
-- Table: user_sub_materi_progress
-- -------------------------
CREATE TABLE IF NOT EXISTS public.user_sub_materi_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sub_materi_id uuid NOT NULL,
  is_unlocked boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  current_poin_index integer DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_sub UNIQUE (user_id, sub_materi_id),
  CONSTRAINT fk_user_sub_sub FOREIGN KEY (sub_materi_id) REFERENCES public.sub_materis (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_sub_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sub_user ON public.user_sub_materi_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sub_sub ON public.user_sub_materi_progress (sub_materi_id);

-- -------------------------
-- Table: user_module_progress
-- -------------------------
CREATE TABLE IF NOT EXISTS public.user_module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL,
  status text DEFAULT 'not-started',  -- 'not-started' | 'in-progress' | 'completed'
  progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_module UNIQUE (user_id, module_id),
  CONSTRAINT fk_user_module_mod FOREIGN KEY (module_id) REFERENCES public.modules (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_module_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_module_user ON public.user_module_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_module ON public.user_module_progress (module_id);

-- -------------------------
-- Table: user_poin_progress
-- -------------------------
CREATE TABLE IF NOT EXISTS public.user_poin_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  poin_id uuid NOT NULL,         -- poin_details.id
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_user_poin UNIQUE (user_id, poin_id),
  CONSTRAINT fk_user_poin_poin FOREIGN KEY (poin_id) REFERENCES public.poin_details (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_poin_user FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_poin_user ON public.user_poin_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_poin_poin ON public.user_poin_progress (poin_id);

-- -------------------------
-- Table: profiles (1:1 with auth.users)
-- -------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,           -- same as auth.users.id
  full_name text,
  phone text,
  email text,
  avatar_url text,
  address text,
  role text DEFAULT 'pengguna',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- -------------------------
-- Table: invitations
-- -------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid,               -- auth.users.id
  role_id integer,               -- roles.id
  token text NOT NULL UNIQUE,
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_invit_inviter FOREIGN KEY (invited_by) REFERENCES auth.users (id),
  CONSTRAINT fk_invit_role FOREIGN KEY (role_id) REFERENCES public.roles (id)
);

-- -------------------------
-- Table: activity_logs
-- -------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,                 -- auth.users.id
  action text NOT NULL,
  target_table text,
  target_id text,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES auth.users (id)
);
