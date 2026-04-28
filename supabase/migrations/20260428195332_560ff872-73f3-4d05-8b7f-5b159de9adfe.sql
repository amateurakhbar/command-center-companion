-- ============ ENUMS ============
CREATE TYPE public.task_status AS ENUM ('to_do','in_progress','waiting','done','killed');
CREATE TYPE public.task_category AS ENUM ('job_application','networking','follow_up','meeting','interview_prep','admin','personal');
CREATE TYPE public.priority AS ENUM ('high','medium','low');
CREATE TYPE public.task_source AS ENUM ('manual','telegram','ai_parser','recurring');
CREATE TYPE public.job_status AS ENUM ('lead','applied','screening','interview','offer','rejected','withdrawn');
CREATE TYPE public.relationship_type AS ENUM ('recruiter','hiring_manager','referral','alumni','friend','investor','operator','other');
CREATE TYPE public.person_status AS ENUM ('to_contact','contacted','replied','meeting_booked','follow_up_due','waiting','dormant','closed');

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  timezone text NOT NULL DEFAULT 'Europe/London',
  telegram_user_id bigint UNIQUE,
  telegram_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (id = auth.uid());
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  morning_time time NOT NULL DEFAULT '09:00',
  midday_time time NOT NULL DEFAULT '13:30',
  evening_time time NOT NULL DEFAULT '20:30',
  quiet_hours_start time,
  quiet_hours_end time,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_own" ON public.settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "settings_insert_own" ON public.settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "settings_update_own" ON public.settings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "settings_delete_own" ON public.settings FOR DELETE USING (user_id = auth.uid());
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  role_title text NOT NULL,
  location text,
  job_url text,
  source text,
  status public.job_status NOT NULL DEFAULT 'lead',
  priority public.priority NOT NULL DEFAULT 'medium',
  next_action text,
  next_action_at timestamptz,
  applied_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_select_own" ON public.jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "jobs_insert_own" ON public.jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "jobs_update_own" ON public.jobs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "jobs_delete_own" ON public.jobs FOR DELETE USING (user_id = auth.uid());
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_jobs_user_status ON public.jobs(user_id, status) WHERE deleted_at IS NULL;

-- ============ PEOPLE ============
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  role_title text,
  linkedin_url text,
  email text,
  phone text,
  relationship_type public.relationship_type NOT NULL DEFAULT 'other',
  status public.person_status NOT NULL DEFAULT 'to_contact',
  priority public.priority NOT NULL DEFAULT 'medium',
  relationship_strength int CHECK (relationship_strength BETWEEN 1 AND 5),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  ask text,
  notes text,
  related_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  timezone text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "people_select_own" ON public.people FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "people_insert_own" ON public.people FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "people_update_own" ON public.people FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "people_delete_own" ON public.people FOR DELETE USING (user_id = auth.uid());
CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_people_user_status ON public.people(user_id, status) WHERE deleted_at IS NULL;

-- ============ RAW_INPUTS (shape only) ============
CREATE TABLE public.raw_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source public.task_source NOT NULL,
  content text NOT NULL,
  parsed_json jsonb,
  parser_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_inputs_select_own" ON public.raw_inputs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "raw_inputs_insert_own" ON public.raw_inputs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "raw_inputs_update_own" ON public.raw_inputs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "raw_inputs_delete_own" ON public.raw_inputs FOR DELETE USING (user_id = auth.uid());

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category public.task_category NOT NULL DEFAULT 'admin',
  priority public.priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'to_do',
  source public.task_source NOT NULL DEFAULT 'manual',
  due_at timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  killed_at timestamptz,
  killed_reason text,
  delay_count int NOT NULL DEFAULT 0,
  last_delayed_at timestamptz,
  parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  related_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  raw_input_id uuid REFERENCES public.raw_inputs(id) ON DELETE SET NULL,
  idempotency_key text,
  position int,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_own" ON public.tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tasks_delete_own" ON public.tasks FOR DELETE USING (user_id = auth.uid());
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_tasks_user_status_due ON public.tasks(user_id, status, due_at) WHERE deleted_at IS NULL;

-- ============ NUDGES (shape only) ============
CREATE TABLE public.nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind text,
  sent_at timestamptz,
  response text,
  response_at timestamptz,
  delivery_status text
);
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nudges_select_own" ON public.nudges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "nudges_insert_own" ON public.nudges FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "nudges_update_own" ON public.nudges FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "nudges_delete_own" ON public.nudges FOR DELETE USING (user_id = auth.uid());

-- ============ DAILY_LOGS (shape only) ============
CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  brief_sent_at timestamptz,
  closeout_at timestamptz,
  score int,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_logs_select_own" ON public.daily_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "daily_logs_insert_own" ON public.daily_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "daily_logs_update_own" ON public.daily_logs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "daily_logs_delete_own" ON public.daily_logs FOR DELETE USING (user_id = auth.uid());
CREATE TRIGGER trg_daily_logs_updated_at BEFORE UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ AUTO-CREATE PROFILE + SETTINGS ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();