CREATE TABLE public.pesquisa_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pesquisa_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pesquisa_callbacks"
  ON public.pesquisa_callbacks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read pesquisa_callbacks"
  ON public.pesquisa_callbacks FOR SELECT TO authenticated
  USING (true);