import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Lock, CheckCircle2 } from 'lucide-react';
import { AGENT_AVATARS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import gemzLogo from '@/assets/gemz-logo.png';

const STORAGE_KEY = 'gemz_onboarding_v1';

const FOUNDATION_STEPS = [
  { id: 'brand-book',       label: 'Brand Book',         sub: 'Identidade da marca',          color: '#DCD6C8' },
  { id: 'market-research',  label: 'Pesquisa de Mercado', sub: 'Mercado e concorrência',       color: '#DCD6C8' },
  { id: 'icp-architect',    label: 'Mapa do ICP',         sub: 'Cliente ideal detalhado',      color: '#DCD6C8' },
  { id: 'pillar-strategist', label: 'Pilares de Conteúdo', sub: 'Temas estratégicos',          color: '#DCD6C8' },
  { id: 'matrix-generator', label: 'Matriz de Conteúdo',  sub: '1000 Big Ideas',               color: '#DCD6C8' },
  { id: 'marketing-manager', label: 'Calendário Editorial', sub: 'Planejamento mensal',        color: '#DCD6C8' },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

const transition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as number[] };

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0);
  const [dir, setDir]         = useState(1);
  const { setActiveAgent, setActivePage } = useChatStore();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const dismiss = (start = false) => {
    localStorage.setItem(STORAGE_KEY, 'done');
    setVisible(false);
    if (start) {
      setActiveAgent('brand-book');
      setActivePage('chat');
    }
  };

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const TOTAL = 5;
  const isLast = step === TOTAL - 1;

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50"
        onClick={() => dismiss()}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="relative w-full max-w-[420px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={gemzLogo} alt="Gemz" className="w-5 h-5 opacity-80" />
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Introdução — {step + 1}/{TOTAL}
            </span>
          </div>
          <button
            onClick={() => dismiss()}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress */}
        <div className="h-0.5 w-full bg-border">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${((step + 1) / TOTAL) * 100}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          />
        </div>

        {/* Steps */}
        <div className="px-6 py-8 min-h-[340px] flex flex-col justify-center overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
            >
              {step === 0 && <StepWelcome />}
              {step === 1 && <StepAgents />}
              {step === 2 && <StepFoundation />}
              {step === 3 && <StepStart />}
              {step === 4 && <StepReady />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center gap-3">
          {step === 0 ? (
            <button
              onClick={() => dismiss()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 h-9"
            >
              Pular
            </button>
          ) : (
            <button
              onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-secondary hover:bg-muted transition-colors text-sm text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
          )}

          <button
            onClick={isLast ? () => dismiss(true) : () => go(step + 1)}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {isLast ? 'Começar agora' : 'Próximo'}
            {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-4">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-5 bg-foreground'
                  : 'w-1 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ── Step 1: Boas-vindas ── */
function StepWelcome() {
  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <img src={gemzLogo} alt="" className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Amanda Content Forge</p>
          <p className="text-xs text-muted-foreground">Sistema de IA para conteúdo estratégico</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <h1 className="greeting-name text-[28px] leading-snug text-foreground">
          Bem-vinda ao sistema.
        </h1>
        <p className="greeting-prompt text-lg text-muted-foreground mt-1">
          Em 5 passos você entende como tudo funciona.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        {[
          '18 agentes especializados, cada um com uma missão',
          'Base estratégica que alimenta todos os conteúdos',
          'Quanto mais você usa, mais personalizado fica',
        ].map((text, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-1 h-1 rounded-full bg-primary-foreground/60 mt-2 shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ── Step 2: Agentes ── */
function StepAgents() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="greeting-name text-[22px] text-foreground leading-snug">18 Agentes de IA</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Cada agente é especializado em uma etapa da sua estratégia. Eles se conectam e o output de um vira input do próximo.
        </p>
      </div>

      <div className="space-y-2">
        {[
          { label: 'Vendas e Produto',       agents: ['brand-book', 'icp-architect'] },
          { label: 'Estratégia e Sistemas',  agents: ['market-research', 'pillar-strategist'] },
          { label: 'Conteúdo',               agents: ['matrix-generator', 'marketing-manager', 'scriptwriter'] },
        ].map(({ label, agents }, gi) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: gi * 0.07 }}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/40"
          >
            <div className="flex -space-x-2">
              {agents.map(id => (
                <img
                  key={id}
                  src={AGENT_AVATARS[id]}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover border-2 border-card"
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{agents.length === 2 ? '5' : '8'} agentes</p>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 leading-relaxed">
        O chat livre (sem agente) sempre está disponível, sem restrições.
      </p>
    </div>
  );
}

/* ── Step 3: Base estratégica ── */
function StepFoundation() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="greeting-name text-[22px] text-foreground leading-snug">Base Estratégica</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Os agentes avançados só são desbloqueados depois que você cria os documentos anteriores. A ordem importa.
        </p>
      </div>

      <div className="space-y-1.5">
        {FOUNDATION_STEPS.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30"
          >
            <img src={AGENT_AVATARS[s.id]} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
            {i === 0 ? (
              <span className="text-[10px] font-medium text-foreground/60 bg-primary px-2 py-0.5 rounded-full">livre</span>
            ) : (
              <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 4: Por onde começar ── */
function StepStart() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="greeting-name text-[22px] text-foreground leading-snug">Comece pelo Brand Book</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          O Brand Book é o único agente sem pré-requisitos. Ele define a identidade da sua marca e desbloqueia todos os outros.
        </p>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/30">
        <img
          src={AGENT_AVATARS['brand-book']}
          alt="Brand Book"
          className="w-14 h-14 rounded-xl object-cover shrink-0"
        />
        <div>
          <p className="text-sm font-semibold text-foreground">Construtor de Brand Book</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Leva ~10 minutos. Define posicionamento, tom de voz, missão e valores da sua marca.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {[
          'Sem Brand Book, nenhum agente avançado funciona',
          'Pode ser feito em partes — salva automaticamente',
          'Você pode atualizar o Brand Book a qualquer momento',
        ].map((text, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-1 h-1 rounded-full bg-muted-foreground/50 mt-2 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Step 5: Pronto ── */
function StepReady() {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, delay: 0.05 }}
      >
        <CheckCircle2 className="w-14 h-14 text-foreground/80" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="greeting-name text-[26px] text-foreground leading-snug">Tudo certo.</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Clique em <strong className="text-foreground">Começar agora</strong> para abrir o Brand Book e dar o primeiro passo.
        </p>
      </div>

      <div className="flex justify-center -space-x-3">
        {['brand-book', 'market-research', 'icp-architect', 'pillar-strategist', 'matrix-generator'].map((id, i) => (
          <motion.img
            key={id}
            src={AGENT_AVATARS[id]}
            alt=""
            className="w-9 h-9 rounded-full object-cover border-2 border-card"
            style={{ zIndex: 10 - i }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.06, type: 'spring', stiffness: 260 }}
          />
        ))}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="w-9 h-9 rounded-full border-2 border-card bg-secondary flex items-center justify-center text-[10px] text-muted-foreground font-medium"
        >
          +13
        </motion.div>
      </div>

      <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 text-left w-full max-w-xs">
        Você pode rever este tutorial acessando <strong className="text-foreground">Ajuda</strong> no menu lateral.
      </p>
    </div>
  );
}
