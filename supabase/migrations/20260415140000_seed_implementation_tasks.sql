-- Seed: Implementation Tasks — CORE Business Program
-- 7 meses × 4 semanas × ~4 tarefas = ~112 tarefas
-- trigger_type: 'manual' | 'document' | 'lesson' | 'agent' | 'metric'
-- trigger_value: tipo de doc ('brand-book','icp','pesquisa','pilares','matriz','calendario','roteiro','outro')
--               ou agentId, ou 'weekly_win'/'monthly_data'/'new_deal'

-- Limpa qualquer seed anterior
DELETE FROM public.implementation_tasks;

INSERT INTO public.implementation_tasks
  (month_title, month_order, week_title, week_order, task_title, task_order, status, tags, tag_colors, trigger_type, trigger_value)
VALUES

-- ═══════════════════════════════════════════════════════════════
-- MÊS 1 — Orientação, Visão e Alinhamento
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Boas-vindas e Introdução
('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 1: Boas-vindas e Introdução', 1,
 'Assistir às aulas de boas-vindas da plataforma', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 1: Boas-vindas e Introdução', 1,
 'Explorar todas as seções e ferramentas disponíveis', 2, 'not-started', ARRAY['Plataforma'], ARRAY['cyan'], 'manual', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 1: Boas-vindas e Introdução', 1,
 'Definir horário fixo de trabalho semanal no programa', 3, 'not-started', ARRAY['Rotina'], ARRAY['purple'], 'manual', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 1: Boas-vindas e Introdução', 1,
 'Configurar perfil com foto e dados do negócio', 4, 'not-started', ARRAY['Perfil'], ARRAY['green'], 'manual', NULL),

-- Semana 2: Banco de Dados de Grandes Ideias
('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 2: Banco de Dados de Grandes Ideias', 2,
 'Assistir às aulas de Brand e posicionamento', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 2: Banco de Dados de Grandes Ideias', 2,
 'Criar o Brand Book completo com o agente', 2, 'not-started', ARRAY['Brand','Documento'], ARRAY['amber','green'], 'document', 'brand-book'),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 2: Banco de Dados de Grandes Ideias', 2,
 'Revisar e aprovar o Brand Book gerado', 3, 'not-started', ARRAY['Brand'], ARRAY['amber'], 'manual', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 2: Banco de Dados de Grandes Ideias', 2,
 'Listar as 10 maiores transformações que você entrega aos clientes', 4, 'not-started', ARRAY['Estratégia'], ARRAY['purple'], 'manual', NULL),

-- Semana 3: Definição de Visão e Audiência
('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 3: Definição de Visão e Audiência', 3,
 'Assistir às aulas sobre ICP e Perfil de Cliente', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 3: Definição de Visão e Audiência', 3,
 'Criar o Perfil do Cliente Ideal (ICP) com o agente', 2, 'not-started', ARRAY['ICP','Documento'], ARRAY['red','green'], 'document', 'icp'),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 3: Definição de Visão e Audiência', 3,
 'Mapear as principais dores e desejos do ICP', 3, 'not-started', ARRAY['ICP'], ARRAY['red'], 'manual', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 3: Definição de Visão e Audiência', 3,
 'Validar o ICP com clientes reais ou cases anteriores', 4, 'not-started', ARRAY['Validação'], ARRAY['cyan'], 'manual', NULL),

-- Semana 4: Alinhamento e Consolidação
('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 4: Alinhamento e Consolidação', 4,
 'Definir a Voz de Marca com o agente especializado', 1, 'not-started', ARRAY['Voz de Marca','Documento'], ARRAY['pink','green'], 'agent', 'voz-de-marca'),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 4: Alinhamento e Consolidação', 4,
 'Consolidar posicionamento: promessa única de valor', 2, 'not-started', ARRAY['Posicionamento'], ARRAY['amber'], 'manual', NULL),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 4: Alinhamento e Consolidação', 4,
 'Enviar primeiro relatório de progresso semanal', 3, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'weekly_win'),

('Mês 1 — Orientação, Visão e Alinhamento', 1, 'Semana 4: Alinhamento e Consolidação', 4,
 'Fazer primeiro chat estratégico com a Amanda AI', 4, 'not-started', ARRAY['IA','Chat'], ARRAY['purple','cyan'], 'agent', 'amanda-ai'),

-- ═══════════════════════════════════════════════════════════════
-- MÊS 2 — Pesquisa, Pilares e Estratégia de Conteúdo
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Pesquisa de Mercado
('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 1: Pesquisa de Mercado', 1,
 'Assistir às aulas sobre pesquisa e análise de mercado', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 1: Pesquisa de Mercado', 1,
 'Realizar Pesquisa de Mercado completa com o agente', 2, 'not-started', ARRAY['Pesquisa','Documento'], ARRAY['cyan','green'], 'document', 'pesquisa'),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 1: Pesquisa de Mercado', 1,
 'Analisar concorrentes diretos e indiretos', 3, 'not-started', ARRAY['Análise'], ARRAY['red'], 'manual', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 1: Pesquisa de Mercado', 1,
 'Identificar gaps e oportunidades de diferenciação', 4, 'not-started', ARRAY['Estratégia'], ARRAY['amber'], 'manual', NULL),

-- Semana 2: Pilares de Conteúdo
('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 2: Pilares de Conteúdo', 2,
 'Assistir às aulas sobre pilares e estratégia de conteúdo', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 2: Pilares de Conteúdo', 2,
 'Criar os Pilares de Conteúdo com o agente', 2, 'not-started', ARRAY['Pilares','Documento'], ARRAY['purple','green'], 'document', 'pilares'),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 2: Pilares de Conteúdo', 2,
 'Validar pilares com o ICP e Brand Book', 3, 'not-started', ARRAY['Validação'], ARRAY['cyan'], 'manual', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 2: Pilares de Conteúdo', 2,
 'Definir a porcentagem de cada pilar no mix de conteúdo', 4, 'not-started', ARRAY['Estratégia'], ARRAY['amber'], 'manual', NULL),

-- Semana 3: Matriz de Conteúdo
('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 3: Matriz de Conteúdo', 3,
 'Assistir às aulas sobre matriz e big ideas', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 3: Matriz de Conteúdo', 3,
 'Criar a Matriz de Conteúdo com o agente', 2, 'not-started', ARRAY['Matriz','Documento'], ARRAY['pink','green'], 'document', 'matriz'),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 3: Matriz de Conteúdo', 3,
 'Gerar 30 big ideas a partir da matriz', 3, 'not-started', ARRAY['Criação'], ARRAY['amber'], 'manual', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 3: Matriz de Conteúdo', 3,
 'Selecionar as 10 melhores ideias para o próximo mês', 4, 'not-started', ARRAY['Planejamento'], ARRAY['purple'], 'manual', NULL),

-- Semana 4: Calendário Editorial
('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 4: Calendário Editorial', 4,
 'Criar o primeiro Calendário Editorial com o agente', 1, 'not-started', ARRAY['Calendário','Documento'], ARRAY['green','amber'], 'document', 'calendario'),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 4: Calendário Editorial', 4,
 'Planejar cadência de publicação semanal', 2, 'not-started', ARRAY['Rotina'], ARRAY['cyan'], 'manual', NULL),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 4: Calendário Editorial', 4,
 'Enviar relatório de progresso do mês', 3, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'monthly_data'),

('Mês 2 — Pesquisa, Pilares e Estratégia de Conteúdo', 2, 'Semana 4: Calendário Editorial', 4,
 'Usar o agente Gerente de Marketing para refinar o plano', 4, 'not-started', ARRAY['IA'], ARRAY['purple'], 'agent', 'marketing-manager'),

-- ═══════════════════════════════════════════════════════════════
-- MÊS 3 — Produção e Roteirização
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Configuração do Creator
('Mês 3 — Produção e Roteirização', 3, 'Semana 1: Configuração do Creator', 1,
 'Assistir às aulas sobre produção de conteúdo', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 1: Configuração do Creator', 1,
 'Configurar setup mínimo de gravação (câmera, luz, áudio)', 2, 'not-started', ARRAY['Setup'], ARRAY['amber'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 1: Configuração do Creator', 1,
 'Definir formato principal de conteúdo (vídeo, texto, podcast)', 3, 'not-started', ARRAY['Formato'], ARRAY['cyan'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 1: Configuração do Creator', 1,
 'Usar o agente Expert Social Selling para plano de autoridade', 4, 'not-started', ARRAY['IA'], ARRAY['purple'], 'agent', 'expert-social-selling'),

-- Semana 2: Roteirização
('Mês 3 — Produção e Roteirização', 3, 'Semana 2: Roteirização', 2,
 'Assistir às aulas sobre roteirização e storytelling', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 2: Roteirização', 2,
 'Criar o primeiro roteiro com o agente Roteirista', 2, 'not-started', ARRAY['Roteiro','Documento'], ARRAY['red','green'], 'document', 'roteiro'),

('Mês 3 — Produção e Roteirização', 3, 'Semana 2: Roteirização', 2,
 'Criar mais 3 roteiros para o mês', 3, 'not-started', ARRAY['Roteiro'], ARRAY['red'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 2: Roteirização', 2,
 'Gravar e editar o primeiro conteúdo', 4, 'not-started', ARRAY['Produção'], ARRAY['amber'], 'manual', NULL),

-- Semana 3: Publicação e Consistência
('Mês 3 — Produção e Roteirização', 3, 'Semana 3: Publicação e Consistência', 3,
 'Publicar o primeiro conteúdo nas redes sociais', 1, 'not-started', ARRAY['Publicação'], ARRAY['green'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 3: Publicação e Consistência', 3,
 'Publicar 3 conteúdos na semana seguindo o calendário', 2, 'not-started', ARRAY['Consistência'], ARRAY['amber'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 3: Publicação e Consistência', 3,
 'Documentar aprendizados e ajustar formato', 3, 'not-started', ARRAY['Melhoria'], ARRAY['cyan'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 3: Publicação e Consistência', 3,
 'Usar o agente Copywriter para criar copies de divulgação', 4, 'not-started', ARRAY['IA'], ARRAY['purple'], 'agent', 'copywriter-campanhas'),

-- Semana 4: Feedback e Ajuste
('Mês 3 — Produção e Roteirização', 3, 'Semana 4: Feedback e Ajuste', 4,
 'Analisar métricas dos primeiros conteúdos publicados', 1, 'not-started', ARRAY['Análise'], ARRAY['red'], 'manual', NULL),

('Mês 3 — Produção e Roteirização', 3, 'Semana 4: Feedback e Ajuste', 4,
 'Usar o agente de Feedback para revisar um conteúdo', 2, 'not-started', ARRAY['IA'], ARRAY['purple'], 'agent', 'feedback-conteudo'),

('Mês 3 — Produção e Roteirização', 3, 'Semana 4: Feedback e Ajuste', 4,
 'Registrar primeiro negócio ou lead gerado', 3, 'not-started', ARRAY['Negócio'], ARRAY['green'], 'metric', 'new_deal'),

('Mês 3 — Produção e Roteirização', 3, 'Semana 4: Feedback e Ajuste', 4,
 'Enviar relatório mensal com resultados e aprendizados', 4, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'monthly_data'),

-- ═══════════════════════════════════════════════════════════════
-- MÊS 4 — Oferta e Comunidade
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Estrutura da Oferta
('Mês 4 — Oferta e Comunidade', 4, 'Semana 1: Estrutura da Oferta', 1,
 'Assistir às aulas sobre criação de ofertas irresistíveis', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 1: Estrutura da Oferta', 1,
 'Criar o Documento de Oferta com o agente', 2, 'not-started', ARRAY['Oferta','Documento'], ARRAY['amber','green'], 'agent', 'criador-documento-oferta'),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 1: Estrutura da Oferta', 1,
 'Definir precificação e posicionamento da oferta', 3, 'not-started', ARRAY['Precificação'], ARRAY['red'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 1: Estrutura da Oferta', 1,
 'Criar VSL (Video de Vendas) com o agente', 4, 'not-started', ARRAY['VSL','IA'], ARRAY['pink','purple'], 'agent', 'vsl-invisivel'),

-- Semana 2: Social Selling
('Mês 4 — Oferta e Comunidade', 4, 'Semana 2: Social Selling Ativo', 2,
 'Assistir às aulas sobre Social Selling', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 2: Social Selling Ativo', 2,
 'Implementar rotina de prospecção ativa (10 DMs/dia)', 2, 'not-started', ARRAY['Vendas'], ARRAY['green'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 2: Social Selling Ativo', 2,
 'Realizar 5 conversas qualificadas com leads', 3, 'not-started', ARRAY['Vendas'], ARRAY['amber'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 2: Social Selling Ativo', 2,
 'Registrar resultados de vendas no sistema', 4, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'new_deal'),

-- Semana 3: Comunidade e Engajamento
('Mês 4 — Oferta e Comunidade', 4, 'Semana 3: Comunidade e Engajamento', 3,
 'Criar estratégia de engajamento com a audiência', 1, 'not-started', ARRAY['Comunidade'], ARRAY['cyan'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 3: Comunidade e Engajamento', 3,
 'Responder 100% dos comentários e DMs da semana', 2, 'not-started', ARRAY['Engajamento'], ARRAY['green'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 3: Comunidade e Engajamento', 3,
 'Criar grupo ou canal de comunidade exclusivo', 3, 'not-started', ARRAY['Comunidade'], ARRAY['purple'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 3: Comunidade e Engajamento', 3,
 'Usar o agente Estrategista Sprint 20k para plano de crescimento', 4, 'not-started', ARRAY['IA'], ARRAY['purple'], 'agent', 'estrategias-sprint-20k'),

-- Semana 4: Resultados do Mês 4
('Mês 4 — Oferta e Comunidade', 4, 'Semana 4: Resultados e Ajuste', 4,
 'Consolidar número de leads e clientes do mês', 1, 'not-started', ARRAY['Análise'], ARRAY['amber'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 4: Resultados e Ajuste', 4,
 'Identificar gargalo principal no funil de vendas', 2, 'not-started', ARRAY['Análise'], ARRAY['red'], 'manual', NULL),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 4: Resultados e Ajuste', 4,
 'Enviar relatório mensal de progresso', 3, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'monthly_data'),

('Mês 4 — Oferta e Comunidade', 4, 'Semana 4: Resultados e Ajuste', 4,
 'Planejar meta de faturamento para o próximo mês', 4, 'not-started', ARRAY['Metas'], ARRAY['amber'], 'manual', NULL),

-- ═══════════════════════════════════════════════════════════════
-- MÊS 5 — Escala e Automação
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Processos e Sistemas
('Mês 5 — Escala e Automação', 5, 'Semana 1: Processos e Sistemas', 1,
 'Assistir às aulas sobre escala e processos', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 1: Processos e Sistemas', 1,
 'Documentar os processos de criação de conteúdo', 2, 'not-started', ARRAY['Processos'], ARRAY['cyan'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 1: Processos e Sistemas', 1,
 'Criar SOPs para produção semanal de conteúdo', 3, 'not-started', ARRAY['Processos'], ARRAY['amber'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 1: Processos e Sistemas', 1,
 'Identificar tarefas que podem ser delegadas ou automatizadas', 4, 'not-started', ARRAY['Escala'], ARRAY['purple'], 'manual', NULL),

-- Semana 2: Estratégia de Formato Longo
('Mês 5 — Escala e Automação', 5, 'Semana 2: Estratégia de Formato Longo', 2,
 'Criar estratégia de conteúdo de formato longo (YouTube, Podcast)', 1, 'not-started', ARRAY['Estratégia'], ARRAY['red'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 2: Estratégia de Formato Longo', 2,
 'Criar roteiro de conteúdo longo com o agente', 2, 'not-started', ARRAY['Roteiro','IA'], ARRAY['red','purple'], 'agent', 'scriptwriter'),

('Mês 5 — Escala e Automação', 5, 'Semana 2: Estratégia de Formato Longo', 2,
 'Publicar primeiro conteúdo longo (video ou artigo)', 3, 'not-started', ARRAY['Publicação'], ARRAY['green'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 2: Estratégia de Formato Longo', 2,
 'Criar sistema de reaproveitamento de conteúdo', 4, 'not-started', ARRAY['Escala'], ARRAY['amber'], 'manual', NULL),

-- Semana 3: Workshops e Eventos
('Mês 5 — Escala e Automação', 5, 'Semana 3: Workshops e Eventos', 3,
 'Assistir às aulas sobre eventos e lançamentos', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 3: Workshops e Eventos', 3,
 'Planejar workshop ou webinar com o agente especializado', 2, 'not-started', ARRAY['Evento','IA'], ARRAY['cyan','purple'], 'agent', 'arquiteta-workshops'),

('Mês 5 — Escala e Automação', 5, 'Semana 3: Workshops e Eventos', 3,
 'Criar página de inscrição e material de divulgação', 3, 'not-started', ARRAY['Lançamento'], ARRAY['amber'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 3: Workshops e Eventos', 3,
 'Realizar o evento e coletar depoimentos dos participantes', 4, 'not-started', ARRAY['Evento'], ARRAY['green'], 'manual', NULL),

-- Semana 4: Escala de Vendas
('Mês 5 — Escala e Automação', 5, 'Semana 4: Escala de Vendas', 4,
 'Implementar funil de vendas automatizado', 1, 'not-started', ARRAY['Funil'], ARRAY['purple'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 4: Escala de Vendas', 4,
 'Criar sequência de e-mails de nutrição', 2, 'not-started', ARRAY['Email'], ARRAY['cyan'], 'manual', NULL),

('Mês 5 — Escala e Automação', 5, 'Semana 4: Escala de Vendas', 4,
 'Fechar pelo menos 2 novos clientes no mês', 3, 'not-started', ARRAY['Vendas'], ARRAY['green'], 'metric', 'new_deal'),

('Mês 5 — Escala e Automação', 5, 'Semana 4: Escala de Vendas', 4,
 'Enviar relatório mensal com faturamento e metas', 4, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'monthly_data'),

-- ═══════════════════════════════════════════════════════════════
-- MÊS 6 — Conversão e Lançamento
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Preparação do Lançamento
('Mês 6 — Conversão e Lançamento', 6, 'Semana 1: Preparação do Lançamento', 1,
 'Assistir às aulas sobre lançamentos e conversão', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 1: Preparação do Lançamento', 1,
 'Definir produto/serviço para o lançamento', 2, 'not-started', ARRAY['Oferta'], ARRAY['amber'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 1: Preparação do Lançamento', 1,
 'Criar campanha de aquecimento com o agente Copywriter', 3, 'not-started', ARRAY['Campanha','IA'], ARRAY['red','purple'], 'agent', 'copywriter-campanhas'),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 1: Preparação do Lançamento', 1,
 'Montar lista de leads para o lançamento', 4, 'not-started', ARRAY['Leads'], ARRAY['green'], 'manual', NULL),

-- Semana 2: Execução do Lançamento
('Mês 6 — Conversão e Lançamento', 6, 'Semana 2: Execução do Lançamento', 2,
 'Publicar conteúdo de aquecimento diariamente', 1, 'not-started', ARRAY['Conteúdo'], ARRAY['amber'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 2: Execução do Lançamento', 2,
 'Realizar live ou webinar de lançamento', 2, 'not-started', ARRAY['Live'], ARRAY['cyan'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 2: Execução do Lançamento', 2,
 'Ativar carrinho e acompanhar vendas em tempo real', 3, 'not-started', ARRAY['Vendas'], ARRAY['green'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 2: Execução do Lançamento', 2,
 'Fechar lançamento e registrar resultado', 4, 'not-started', ARRAY['Resultado'], ARRAY['amber'], 'metric', 'new_deal'),

-- Semana 3: Pós-Lançamento e Entrega
('Mês 6 — Conversão e Lançamento', 6, 'Semana 3: Pós-Lançamento e Entrega', 3,
 'Onboarding dos novos clientes', 1, 'not-started', ARRAY['Entrega'], ARRAY['green'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 3: Pós-Lançamento e Entrega', 3,
 'Coletar depoimentos e resultados dos clientes', 2, 'not-started', ARRAY['Prova'], ARRAY['amber'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 3: Pós-Lançamento e Entrega', 3,
 'Criar case de sucesso detalhado para usar em conteúdo', 3, 'not-started', ARRAY['Case'], ARRAY['purple'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 3: Pós-Lançamento e Entrega', 3,
 'Analisar o que funcionou e o que ajustar no próximo lançamento', 4, 'not-started', ARRAY['Análise'], ARRAY['red'], 'manual', NULL),

-- Semana 4: Consolidação
('Mês 6 — Conversão e Lançamento', 6, 'Semana 4: Consolidação e Próximos Passos', 4,
 'Documentar resultados totais do lançamento', 1, 'not-started', ARRAY['Resultado'], ARRAY['amber'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 4: Consolidação e Próximos Passos', 4,
 'Refinar oferta e precificação para próximo ciclo', 2, 'not-started', ARRAY['Oferta'], ARRAY['cyan'], 'manual', NULL),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 4: Consolidação e Próximos Passos', 4,
 'Enviar relatório mensal completo', 3, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'monthly_data'),

('Mês 6 — Conversão e Lançamento', 6, 'Semana 4: Consolidação e Próximos Passos', 4,
 'Definir meta financeira para o Mês 7', 4, 'not-started', ARRAY['Metas'], ARRAY['amber'], 'manual', NULL),

-- ═══════════════════════════════════════════════════════════════
-- MÊS 7 — Valor, Legado e Expansão
-- ═══════════════════════════════════════════════════════════════

-- Semana 1: Marca Pessoal e Legado
('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 1: Marca Pessoal e Legado', 1,
 'Assistir às aulas sobre posicionamento de autoridade', 1, 'not-started', ARRAY['Aula'], ARRAY['blue'], 'lesson', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 1: Marca Pessoal e Legado', 1,
 'Revisitar e atualizar o Brand Book com novos aprendizados', 2, 'not-started', ARRAY['Brand'], ARRAY['amber'], 'document', 'brand-book'),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 1: Marca Pessoal e Legado', 1,
 'Criar manifesto ou "Por que existo" do negócio', 3, 'not-started', ARRAY['Marca'], ARRAY['purple'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 1: Marca Pessoal e Legado', 1,
 'Publicar conteúdo de autoridade maxima (tese, manifesto)', 4, 'not-started', ARRAY['Autoridade'], ARRAY['red'], 'manual', NULL),

-- Semana 2: Expansão de Receita
('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 2: Expansão de Receita', 2,
 'Mapear novas fontes de receita (mentoria, curso, infoproduto)', 1, 'not-started', ARRAY['Receita'], ARRAY['green'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 2: Expansão de Receita', 2,
 'Criar oferta de alto valor (mentoria individual ou grupo)', 2, 'not-started', ARRAY['Oferta'], ARRAY['amber'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 2: Expansão de Receita', 2,
 'Planejar produto de entrada (lead magnet premium)', 3, 'not-started', ARRAY['Produto'], ARRAY['cyan'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 2: Expansão de Receita', 2,
 'Registrar novos negócios e parcerias estratégicas', 4, 'not-started', ARRAY['Expansão'], ARRAY['green'], 'metric', 'new_deal'),

-- Semana 3: Escalabilidade Final
('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 3: Escalabilidade e Time', 3,
 'Avaliar necessidade de contratação ou parceria', 1, 'not-started', ARRAY['Time'], ARRAY['purple'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 3: Escalabilidade e Time', 3,
 'Documentar todos os processos do negócio em SOPs', 2, 'not-started', ARRAY['Processos'], ARRAY['cyan'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 3: Escalabilidade e Time', 3,
 'Definir métricas-chave do negócio (KPIs) para acompanhar', 3, 'not-started', ARRAY['KPIs'], ARRAY['amber'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 3: Escalabilidade e Time', 3,
 'Criar dashboard de acompanhamento de resultados', 4, 'not-started', ARRAY['Dashboard'], ARRAY['red'], 'manual', NULL),

-- Semana 4: Celebração e Próximos Ciclos
('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 4: Celebração e Próximos Ciclos', 4,
 'Calcular o crescimento total dos 7 meses do programa', 1, 'not-started', ARRAY['Resultado'], ARRAY['amber'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 4: Celebração e Próximos Ciclos', 4,
 'Compartilhar resultados com a comunidade e inspirar outros', 2, 'not-started', ARRAY['Comunidade'], ARRAY['green'], 'manual', NULL),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 4: Celebração e Próximos Ciclos', 4,
 'Enviar relatório final completo do programa', 3, 'not-started', ARRAY['Métrica'], ARRAY['green'], 'metric', 'monthly_data'),

('Mês 7 — Valor, Legado e Expansão', 7, 'Semana 4: Celebração e Próximos Ciclos', 4,
 'Planejar próximos 6 meses com base nos resultados conquistados', 4, 'not-started', ARRAY['Planejamento'], ARRAY['purple'], 'manual', NULL);
