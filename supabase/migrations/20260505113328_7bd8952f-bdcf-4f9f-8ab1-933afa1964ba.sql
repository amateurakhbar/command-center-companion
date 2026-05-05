ALTER TABLE public.nudges 
  ADD COLUMN IF NOT EXISTS nudge_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS nudges_user_nudge_key_uniq 
  ON public.nudges (user_id, nudge_key) 
  WHERE nudge_key IS NOT NULL;