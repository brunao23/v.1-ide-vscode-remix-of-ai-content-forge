-- Formulário semanal: Monday Wins
CREATE TABLE IF NOT EXISTS public.weekly_wins_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  top_win_1 TEXT NOT NULL,
  top_win_2 TEXT,
  top_win_3 TEXT,
  one_focus_this_week TEXT,
  blocker TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Formulário mensal: métricas de negócio
CREATE TABLE IF NOT EXISTS public.monthly_data_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),

  total_cash_collected NUMERIC(12,2),
  total_new_revenue NUMERIC(12,2),
  monthly_recurring_revenue NUMERIC(12,2),
  monthly_expenses NUMERIC(12,2),
  ad_spend NUMERIC(12,2),
  new_clients_signed INTEGER,
  active_clients INTEGER,
  confidence_score NUMERIC(4,1),

  booked_calls INTEGER,
  calls_showed INTEGER,
  triage_calls INTEGER,
  strategy_calls INTEGER,
  offers_made INTEGER,
  inbound_messages INTEGER,

  total_followers INTEGER,
  reach INTEGER,
  views INTEGER,
  posts_made INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_month, period_year)
);

-- Formulário: novo negócio fechado
CREATE TABLE IF NOT EXISTS public.new_deal_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_name TEXT NOT NULL,
  offer_name TEXT,
  deal_value NUMERIC(12,2),
  cash_collected NUMERIC(12,2),
  payment_type TEXT NOT NULL DEFAULT 'one-time' CHECK (
    payment_type IN ('one-time', 'installments', 'recurring', 'other')
  ),
  source_channel TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_wins_user_date
  ON public.weekly_wins_submissions(user_id, reference_date DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_data_user_period
  ON public.monthly_data_submissions(user_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_new_deals_user_date
  ON public.new_deal_submissions(user_id, deal_date DESC);

ALTER TABLE public.weekly_wins_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_data_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.new_deal_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- weekly_wins_submissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_wins_submissions'
      AND policyname = 'Users manage own weekly wins'
  ) THEN
    CREATE POLICY "Users manage own weekly wins"
      ON public.weekly_wins_submissions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'weekly_wins_submissions'
      AND policyname = 'Service role full access weekly wins'
  ) THEN
    CREATE POLICY "Service role full access weekly wins"
      ON public.weekly_wins_submissions
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- monthly_data_submissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'monthly_data_submissions'
      AND policyname = 'Users manage own monthly data'
  ) THEN
    CREATE POLICY "Users manage own monthly data"
      ON public.monthly_data_submissions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'monthly_data_submissions'
      AND policyname = 'Service role full access monthly data'
  ) THEN
    CREATE POLICY "Service role full access monthly data"
      ON public.monthly_data_submissions
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- new_deal_submissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'new_deal_submissions'
      AND policyname = 'Users manage own new deals'
  ) THEN
    CREATE POLICY "Users manage own new deals"
      ON public.new_deal_submissions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'new_deal_submissions'
      AND policyname = 'Service role full access new deals'
  ) THEN
    CREATE POLICY "Service role full access new deals"
      ON public.new_deal_submissions
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_weekly_wins_submissions_updated_at ON public.weekly_wins_submissions;
CREATE TRIGGER update_weekly_wins_submissions_updated_at
  BEFORE UPDATE ON public.weekly_wins_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_data_submissions_updated_at ON public.monthly_data_submissions;
CREATE TRIGGER update_monthly_data_submissions_updated_at
  BEFORE UPDATE ON public.monthly_data_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_new_deal_submissions_updated_at ON public.new_deal_submissions;
CREATE TRIGGER update_new_deal_submissions_updated_at
  BEFORE UPDATE ON public.new_deal_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
