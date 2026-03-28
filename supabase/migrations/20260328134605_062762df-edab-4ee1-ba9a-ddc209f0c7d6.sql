
-- Table: user_feeds
CREATE TABLE public.user_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feeds" ON public.user_feeds
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Limit 10 feeds per user via trigger
CREATE OR REPLACE FUNCTION public.check_max_feeds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_feeds WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Máximo de 10 feeds por usuário atingido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_feeds
  BEFORE INSERT ON public.user_feeds
  FOR EACH ROW EXECUTE FUNCTION public.check_max_feeds();

-- Table: articles
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES public.user_feeds(id) ON DELETE CASCADE,
  title text NOT NULL,
  link text NOT NULL,
  summary text,
  image text,
  source_name text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, link)
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own articles" ON public.articles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own articles" ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own articles" ON public.articles
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Table: user_settings
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mercado text,
  nicho text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
