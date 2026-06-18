
CREATE TABLE public.validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  idea TEXT NOT NULL,
  industry TEXT,
  country TEXT,
  audience TEXT,
  budget TEXT,
  business_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  score INT,
  verdict TEXT,
  report JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.validations TO authenticated;
GRANT ALL ON public.validations TO service_role;

ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own validations"
ON public.validations FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX validations_user_created_idx ON public.validations(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validations_set_updated_at
BEFORE UPDATE ON public.validations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
