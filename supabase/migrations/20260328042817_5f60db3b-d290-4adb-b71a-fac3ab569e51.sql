
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create client_metrics table
CREATE TABLE public.client_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  total_new_revenue DECIMAL(12,2),
  total_cash_collected DECIMAL(12,2),
  monthly_recurring_revenue DECIMAL(12,2),
  expenses DECIMAL(12,2),
  profit DECIMAL(12,2),
  ad_spend DECIMAL(12,2),
  daily_ad_spend DECIMAL(12,2),
  advertising_reach_ig INTEGER,
  advertising_impressions_ig INTEGER,
  cpm DECIMAL(8,2),
  roas DECIMAL(8,2),
  short_form_channel_size INTEGER,
  total_reach_ig_impressions_li INTEGER,
  total_posts_made INTEGER,
  long_form_channel_size INTEGER,
  long_form_monthly_audience INTEGER,
  youtube_total_views INTEGER,
  youtube_total_hours INTEGER,
  total_videos_podcasts_made INTEGER,
  email_list_size INTEGER,
  new_subscribers INTEGER,
  net_new_subscribers INTEGER,
  new_clients INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_month, period_year)
);

ALTER TABLE public.client_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own metrics" ON public.client_metrics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics" ON public.client_metrics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics" ON public.client_metrics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all metrics" ON public.client_metrics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage all metrics" ON public.client_metrics
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role full access
CREATE POLICY "Service role full access" ON public.client_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_client_metrics_updated_at
  BEFORE UPDATE ON public.client_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
