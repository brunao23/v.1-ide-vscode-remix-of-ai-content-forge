
-- Tabela de módulos
CREATE TABLE public.lesson_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de aulas
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.lesson_modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  loom_id TEXT NOT NULL,
  duration TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de progresso do usuário
CREATE TABLE public.user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- RLS
ALTER TABLE public.lesson_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

-- Módulos e aulas são públicos para leitura (autenticados)
CREATE POLICY "Authenticated can view modules" ON public.lesson_modules
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Authenticated can view lessons" ON public.lessons
  FOR SELECT TO authenticated USING (is_active = true);

-- Progresso: usuários gerenciam o próprio
CREATE POLICY "Users manage own progress" ON public.user_lesson_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role pode gerenciar tudo (para admin)
CREATE POLICY "Service role manages modules" ON public.lesson_modules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages lessons" ON public.lessons
  FOR ALL TO service_role USING (true) WITH CHECK (true);
