CREATE POLICY "Anon can view demo metrics" ON public.client_metrics
  FOR SELECT TO anon USING (true);