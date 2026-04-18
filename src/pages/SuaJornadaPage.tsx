import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

type Temperature = 'red' | 'orange' | 'green' | null;
type AuditState = Record<string, Temperature>;

const STORAGE_KEY = 'jornada-audit-state';

function loadAuditState(): AuditState {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

// ─── Data ──────────────────────────────────────────────────────────────────

type Level = 'above20k' | 'below20k';

interface ModuleCell { code: string; name: string; level: Level; }
interface AuditItem { category: string; code: string; description: string; }

const GRID_ROWS: ModuleCell[][] = [
  [
    { code: 'AT6', name: 'Calendário de Campanhas', level: 'above20k' },
    { code: 'ED6', name: 'Ofertas Backstage™', level: 'above20k' },
    { code: 'CO6', name: 'IA + Sistemas', level: 'above20k' },
    { code: 'EN6', name: 'Contratando Gente Boa', level: 'above20k' },
  ],
  [
    { code: 'AT5', name: 'Anúncios de Volante de Aquisição', level: 'above20k' },
    { code: 'ED5', name: 'VSL Invisível', level: 'above20k' },
    { code: 'CO5', name: 'Storyselling via Email', level: 'above20k' },
    { code: 'EN5', name: 'Coleta de Provas', level: 'above20k' },
  ],
  [
    { code: 'AT4', name: 'Múltiplas Iscas Digitais', level: 'above20k' },
    { code: 'ED4', name: 'Comunidade Fiel da Marca', level: 'above20k' },
    { code: 'CO4', name: 'Como Lançar Ofertas', level: 'above20k' },
    { code: 'EN4', name: 'Onboarding Padrão Ouro™', level: 'above20k' },
  ],
  [
    { code: 'AT3', name: 'Personagem Atrativo™', level: 'below20k' },
    { code: 'ED3', name: 'Sistema DM Close™', level: 'below20k' },
    { code: 'CO3', name: 'Como Lançar Ofertas', level: 'below20k' },
    { code: 'EN3', name: 'Entrega Padrão Ouro™', level: 'below20k' },
  ],
  [
    { code: 'AT2', name: 'O Ritmo Semanal', level: 'below20k' },
    { code: 'ED2', name: 'CRM Unificado', level: 'below20k' },
    { code: 'CO2', name: 'Documento da Oferta', level: 'below20k' },
    { code: 'EN2', name: 'Golden Offer™', level: 'below20k' },
  ],
  [
    { code: 'AT1', name: 'Constância de Posts de Infotenimento™', level: 'below20k' },
    { code: 'ED1', name: 'A Mini Série', level: 'below20k' },
    { code: 'CO1', name: 'Modelo Sistema Assinatura™', level: 'below20k' },
    { code: 'EN1', name: 'Pesquisa de Mercado', level: 'below20k' },
  ],
];

const AUDIT_BELOW_20K: AuditItem[] = [
  { category: 'ATRAIR',   code: 'AT1', description: 'Eu atraio novos seguidores com o meu conteúdo todos os dias' },
  { category: 'ATRAIR',   code: 'AT2', description: 'Sei exatamente o que postar cada semana para crescer e converter' },
  { category: 'ATRAIR',   code: 'AT3', description: 'Consigo iniciar 5 conversas qualificadas na DM todos os dias sem anúncios pagos' },
  { category: 'EDUCAR',   code: 'ED1', description: 'Tenho um Mini-Curso por Email que funciona como Isca Digital principal + Sequência de Boas-Vindas' },
  { category: 'EDUCAR',   code: 'ED2', description: 'Tenho uma forma de acompanhar leads, conversas, pagamentos e progresso dos clientes' },
  { category: 'EDUCAR',   code: 'ED3', description: 'Só falo com prospects de 4 e 5 estrelas usando o Sistema DM Close™' },
  { category: 'CONVIDAR', code: 'CO1', description: 'Os meus clientes têm a primeira grande vitória nos primeiros 30 dias' },
  { category: 'CONVIDAR', code: 'CO2', description: 'Tenho um Documento de Oferta que descreve a minha oferta de forma clara para o lead' },
  { category: 'CONVIDAR', code: 'CO3', description: 'Eu tenho clareza de como lançar minha Golden Offer para o meu mercado e vender de forma previsível' },
  { category: 'ENCANTAR', code: 'EN1', description: 'O meu programa resolve uma dor profunda que a minha audiência já está tentando resolver' },
  { category: 'ENCANTAR', code: 'EN2', description: 'Tenho a oferta principal clara, com Jornada do Cliente criada, que consigo vender por pelo menos R$3k' },
  { category: 'ENCANTAR', code: 'EN3', description: 'Tenho Jornada do Cliente, Sistema Checklist™ e Rivotris™, e meus clientes têm resultado aplicando' },
];

const AUDIT_ABOVE_20K: AuditItem[] = [
  { category: 'ATRAIR',   code: 'AT4', description: 'Meus posts de conteúdo curto estão gerando leads interessados no meu programa todos os dias' },
  { category: 'ATRAIR',   code: 'AT5', description: 'Invisto uma proporção do meu faturamento mensal pra amplificar conteúdo que já está funcionando' },
  { category: 'ATRAIR',   code: 'AT6', description: 'Meu calendário de marketing está claramente planejado pro próximo mês' },
  { category: 'EDUCAR',   code: 'ED4', description: 'Eu posto conteúdo longo toda semana para construir minha Comunidade Fiel' },
  { category: 'EDUCAR',   code: 'ED5', description: 'Os clientes compram sem precisar de persuasão ou gatilhos, na DM ou em call de vendas' },
  { category: 'EDUCAR',   code: 'ED6', description: 'Eu encho um workshop Backstage™ low ticket com uma campanha de 7 dias de captação' },
  { category: 'CONVIDAR', code: 'CO4', description: 'Eu tenho clareza de como lançar minha Golden Offer e vender de forma previsível' },
  { category: 'CONVIDAR', code: 'CO5', description: 'Processo de Onboarding está mapeado, é claro, sem atrito e não depende de mim [acessos]' },
  { category: 'CONVIDAR', code: 'CO6', description: 'Eu não sou o gargalo — meus clientes têm resultado mesmo quando eu estou offline' },
  { category: 'ENCANTAR', code: 'EN4', description: 'O Onboarding e recursos que entrego dão clareza total ao cliente do que esperar e próximos passos' },
  { category: 'ENCANTAR', code: 'EN5', description: 'Tenho pelo menos 5 Entrevistas de Estudo de Caso mostrando a transformação que eu prometo' },
  { category: 'ENCANTAR', code: 'EN6', description: 'Eu só faço tarefas de alta alavancagem, minha Zona de Genialidade e que me energizam' },
];

const CATEGORY_ORDER = ['ATRAIR', 'EDUCAR', 'CONVIDAR', 'ENCANTAR'];

// ─── Sub-components ────────────────────────────────────────────────────────

function TempSquare({ temp, selected, onClick }: {
  temp: 'red' | 'orange' | 'green';
  selected: boolean;
  onClick: () => void;
}) {
  const base: Record<string, string> = {
    red:    'bg-red-400 hover:bg-red-300',
    orange: 'bg-orange-400 hover:bg-orange-300',
    green:  'bg-green-500 hover:bg-green-400',
  };
  return (
    <button
      onClick={onClick}
      title={temp === 'red' ? 'Ainda não' : temp === 'orange' ? 'Em progresso' : 'Sim, tenho isso'}
      className={`w-6 h-6 rounded-sm transition-all duration-150 border-2 ${base[temp]} ${
        selected
          ? 'border-white scale-110 shadow-lg shadow-black/30'
          : 'border-transparent opacity-35 hover:opacity-65'
      }`}
    />
  );
}

function AuditTable({ items, level }: { items: AuditItem[]; level: 'below20k' | 'above20k' }) {
  const [auditState, setAuditState] = useState<AuditState>(loadAuditState);

  const setTemp = (code: string, temp: 'red' | 'orange' | 'green') => {
    setAuditState(prev => {
      const next = { ...prev, [code]: prev[code] === temp ? null : temp };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const accentColor = level === 'above20k' ? 'text-violet-400' : 'text-orange-400';
  const badgeBg = level === 'above20k' ? 'bg-violet-400/10 text-violet-300' : 'bg-orange-400/10 text-orange-300';

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {CATEGORY_ORDER.map(cat => {
            const catItems = items.filter(i => i.category === cat);
            if (catItems.length === 0) return null;
            return catItems.map((item, idx) => (
              <tr key={item.code} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                {idx === 0 && (
                  <td
                    rowSpan={catItems.length}
                    className={`font-bold text-xs uppercase tracking-wider text-center align-middle border-r border-border/40 px-3 py-2 whitespace-nowrap ${accentColor}`}
                    style={{ minWidth: '80px' }}
                  >
                    {cat}
                  </td>
                )}
                <td className={`px-2 py-2.5 font-mono font-bold text-xs ${badgeBg} border-r border-border/30 text-center whitespace-nowrap`} style={{ minWidth: '48px' }}>
                  {item.code}
                </td>
                <td className="px-4 py-2.5 text-foreground/90 text-sm leading-snug">
                  {item.description}
                </td>
                <td className="px-3 py-2.5 border-l border-border/30">
                  <div className="flex gap-1.5 items-center">
                    {(['red', 'orange', 'green'] as const).map(t => (
                      <TempSquare
                        key={t}
                        temp={t}
                        selected={auditState[item.code] === t}
                        onClick={() => setTemp(item.code, t)}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function SideBracket({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minWidth: '32px' }}>
      <div
        className="flex flex-col items-center justify-center gap-1 text-muted-foreground/60"
        style={{ height: `${rows * 44}px` }}
      >
        <div className="flex-1 border-r-2 border-t-2 border-b-2 border-muted-foreground/30 rounded-r-md w-3" />
        <span className="text-[10px] font-medium tracking-widest rotate-90 whitespace-nowrap uppercase" style={{ minWidth: '60px', textAlign: 'center' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function SuaJornadaPage() {
  const { setActivePage } = useChatStore();

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sua Jornada</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O roadmap do programa Core Business® e seu diagnóstico de onde estás agora.
          </p>
        </div>

        {/* ── Panel 1: The Roadmap ─────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">O Roadmap</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique em um card para acessar a aula correspondente.
            </p>
          </div>

          <div className="rounded-xl overflow-hidden border-2 border-violet-500/40 bg-black">
            {/* Brand header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-2">
              <div>
                <p className="text-white font-black text-lg leading-none tracking-tight">CORE<br />BUSINESS®</p>
                <p className="text-white/50 text-[10px] mt-1">made for creator founders.</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-xs tracking-widest uppercase">Loulou</p>
                <p className="text-white/50 text-[10px] tracking-widest uppercase">Studios</p>
              </div>
            </div>

            {/* Column headers */}
            <div className="flex">
              <div className="w-12 shrink-0" />
              {['ATRAIR', 'EDUCAR', 'CONVIDAR', 'ENCANTAR'].map(cat => (
                <div key={cat} className="flex-1 text-center py-2.5 text-white font-bold text-xs uppercase tracking-[0.15em] border-l border-gray-700/60">
                  {cat}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex border-t border-gray-700/60">
              {/* Left labels */}
              <div className="w-12 shrink-0 flex flex-col border-r border-gray-700/60">
                <div className="flex-1 flex items-center justify-center border-b border-gray-700/60" style={{ minHeight: '144px' }}>
                  <span className="-rotate-90 text-white text-xs font-bold whitespace-nowrap">&gt;20k</span>
                </div>
                <div className="flex-1 flex items-center justify-center" style={{ minHeight: '144px' }}>
                  <span className="-rotate-90 text-white text-xs font-bold whitespace-nowrap">&lt;20k</span>
                </div>
              </div>

              {/* 4 category columns */}
              <div className="flex-1 grid grid-cols-4">
                {GRID_ROWS.map((row, rowIdx) =>
                  row.map((cell) => (
                    <button
                      key={cell.code}
                      onClick={() => setActivePage('aulas')}
                      className={`flex border-b border-r border-gray-700/60 group transition-transform duration-150 hover:scale-[1.04] hover:z-10 hover:shadow-xl text-left ${
                        rowIdx === 2 ? 'border-b-gray-500' : ''
                      }`}
                      title={`Abrir aula: ${cell.name}`}
                    >
                      <div className={`flex items-center justify-center w-10 shrink-0 text-[10px] font-black leading-tight text-center py-2 text-black ${
                        cell.level === 'above20k' ? 'bg-violet-400' : 'bg-orange-300'
                      }`}>
                        {cell.code}
                      </div>
                      <div className="bg-white flex-1 flex items-center justify-center px-1.5 py-2 min-h-[48px]">
                        <span className="text-[10px] font-semibold text-black leading-tight text-center">{cell.name}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Panel 2: Checklist <20k ──────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-end gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                checklist de auditoria:{' '}
                <span className="text-orange-400">abaixo de R$20k/mês</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Avalie sua temperatura em cada item — vermelho (ainda não), laranja (em progresso), verde (sim).
              </p>
            </div>
            <div className="flex items-center gap-1.5 pb-0.5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-gray-400" title="~5k/m" />
              <div className="w-3 h-3 rounded-full bg-violet-400" title="~10k/m" />
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="flex">
              <div className="flex-1 min-w-0">
                <AuditTable items={AUDIT_BELOW_20K} level="below20k" />
              </div>
              {/* Side brackets */}
              <div className="flex flex-col shrink-0 border-l border-border/30 px-2 py-1">
                <div className="flex items-center justify-center flex-1">
                  <div className="flex flex-col items-center" style={{ height: `${6 * 44}px` }}>
                    <div className="flex-1 w-0 border-l-0" />
                    <div className="relative flex items-center justify-center w-full" style={{ height: `${3 * 44}px` }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 border-t-2 border-b-2 border-r-2 border-muted-foreground/30 rounded-r" />
                      <span className="rotate-90 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap mr-1">maior</span>
                    </div>
                    <div className="relative flex items-center justify-center w-full" style={{ height: `${3 * 44}px` }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 border-t-2 border-b-2 border-r-2 border-muted-foreground/30 rounded-r" />
                      <span className="rotate-90 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap mr-1">melhor</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Panel 3: Checklist >20k ──────────────────────────────────── */}
        <section className="space-y-3 pb-12">
          <div className="flex items-end gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                checklist de auditoria:{' '}
                <span className="text-violet-400">acima de R$20k/mês</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Avalie sua temperatura em cada item — vermelho (ainda não), laranja (em progresso), verde (sim).
              </p>
            </div>
            <div className="flex items-center gap-1.5 pb-0.5 shrink-0">
              {[
                { color: 'bg-orange-400',  label: '20k/m' },
                { color: 'bg-emerald-500', label: '40k/m' },
                { color: 'bg-blue-400',    label: '60k/m' },
                { color: 'bg-indigo-500',  label: '80k/m' },
                { color: 'bg-violet-500',  label: '100k/m' },
              ].map(dot => (
                <div key={dot.label} className="flex items-center gap-1" title={dot.label}>
                  <div className={`w-3 h-3 rounded-full ${dot.color}`} />
                  <span className="text-[9px] text-muted-foreground/60">{dot.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="flex">
              <div className="flex-1 min-w-0">
                <AuditTable items={AUDIT_ABOVE_20K} level="above20k" />
              </div>
              {/* Side brackets */}
              <div className="flex flex-col shrink-0 border-l border-border/30 px-2 py-1">
                <div className="flex items-center justify-center flex-1">
                  <div className="flex flex-col items-center" style={{ height: `${6 * 44}px` }}>
                    <div className="relative flex items-center justify-center w-full" style={{ height: `${3 * 44}px` }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 border-t-2 border-b-2 border-r-2 border-muted-foreground/30 rounded-r" />
                      <span className="rotate-90 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap mr-1">maior</span>
                    </div>
                    <div className="relative flex items-center justify-center w-full" style={{ height: `${3 * 44}px` }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 border-t-2 border-b-2 border-r-2 border-muted-foreground/30 rounded-r" />
                      <span className="rotate-90 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap mr-1">melhor</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
