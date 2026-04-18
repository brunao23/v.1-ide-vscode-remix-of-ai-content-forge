import { useState } from 'react';

type Temperature = 'red' | 'orange' | 'green' | null;
type AuditState = Record<string, Temperature>;

const STORAGE_KEY = 'jornada-audit-state';

function loadAuditState(): AuditState {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

type Level = 'above20k' | 'below20k';

interface ModuleCell {
  code: string;
  name: string;
  level: Level;
  desc: string;
}

const GRID_ROWS: ModuleCell[][] = [
  [
    { code: 'AT6', name: 'Calendário de Campanhas', level: 'above20k', desc: 'Meu calendário de marketing está claramente planejado pro próximo mês' },
    { code: 'ED6', name: 'Ofertas Backstage™', level: 'above20k', desc: 'Eu encho um workshop Backstage™ low ticket com uma campanha de 7 dias de captação' },
    { code: 'CO6', name: 'IA + Sistemas', level: 'above20k', desc: 'Eu não sou o gargalo — meus clientes têm resultado mesmo quando eu estou offline' },
    { code: 'EN6', name: 'Contratando Gente Boa', level: 'above20k', desc: 'Eu só faço tarefas de alta alavancagem, minha Zona de Genialidade e que me energizam' },
  ],
  [
    { code: 'AT5', name: 'Anúncios de Volante de Aquisição', level: 'above20k', desc: 'Invisto uma proporção do meu faturamento mensal pra amplificar conteúdo que já está funcionando' },
    { code: 'ED5', name: 'VSL Invisível', level: 'above20k', desc: 'Os clientes compram sem precisar de persuasão ou gatilhos, na DM ou em call de vendas' },
    { code: 'CO5', name: 'Storyselling via Email', level: 'above20k', desc: 'Processo de Onboarding está mapeado, é claro, sem atrito e não depende de mim' },
    { code: 'EN5', name: 'Coleta de Provas', level: 'above20k', desc: 'Tenho pelo menos 5 Entrevistas de Estudo de Caso mostrando a transformação que eu prometo' },
  ],
  [
    { code: 'AT4', name: 'Múltiplas Iscas Digitais', level: 'above20k', desc: 'Meus posts de conteúdo curto estão gerando leads interessados no meu programa todos os dias' },
    { code: 'ED4', name: 'Comunidade Fiel da Marca', level: 'above20k', desc: 'Eu posto conteúdo longo toda semana para construir minha Comunidade Fiel' },
    { code: 'CO4', name: 'Como Lançar Ofertas', level: 'above20k', desc: 'Eu tenho clareza de como lançar minha Golden Offer e vender de forma previsível' },
    { code: 'EN4', name: 'Onboarding Padrão Ouro™', level: 'above20k', desc: 'O Onboarding e recursos que entrego dão clareza total ao cliente do que esperar e próximos passos' },
  ],
  [
    { code: 'AT3', name: 'Personagem Atrativo™', level: 'below20k', desc: 'Consigo iniciar 5 conversas qualificadas na DM todos os dias sem anúncios pagos' },
    { code: 'ED3', name: 'Sistema DM Close™', level: 'below20k', desc: 'Só falo com prospects de 4 e 5 estrelas usando o Sistema DM Close™' },
    { code: 'CO3', name: 'Como Lançar Ofertas', level: 'below20k', desc: 'Eu tenho clareza de como lançar minha Golden Offer para o meu mercado e vender de forma previsível' },
    { code: 'EN3', name: 'Entrega Padrão Ouro™', level: 'below20k', desc: 'Tenho Jornada do Cliente, Sistema Checklist™ e Rivotris™, e meus clientes têm resultado aplicando' },
  ],
  [
    { code: 'AT2', name: 'O Ritmo Semanal', level: 'below20k', desc: 'Sei exatamente o que postar cada semana para crescer e converter' },
    { code: 'ED2', name: 'CRM Unificado', level: 'below20k', desc: 'Tenho uma forma de acompanhar leads, conversas, pagamentos e progresso dos clientes' },
    { code: 'CO2', name: 'Documento da Oferta', level: 'below20k', desc: 'Tenho um Documento de Oferta que descreve a minha oferta de forma clara para o lead' },
    { code: 'EN2', name: 'Golden Offer™', level: 'below20k', desc: 'Tenho a oferta principal clara, com Jornada do Cliente criada, que consigo vender por pelo menos R$3k' },
  ],
  [
    { code: 'AT1', name: 'Constância de Posts de Infotenimento™', level: 'below20k', desc: 'Eu atraio novos seguidores com o meu conteúdo todos os dias' },
    { code: 'ED1', name: 'A Mini Série', level: 'below20k', desc: 'Tenho um Mini-Curso por Email que funciona como Isca Digital principal + Sequência de Boas-Vindas' },
    { code: 'CO1', name: 'Modelo Sistema Assinatura™', level: 'below20k', desc: 'Os meus clientes têm a primeira grande vitória nos primeiros 30 dias' },
    { code: 'EN1', name: 'Pesquisa de Mercado', level: 'below20k', desc: 'O meu programa resolve uma dor profunda que a minha audiência já está tentando resolver' },
  ],
];

const TEMP_COLORS: Record<'red' | 'orange' | 'green', string> = {
  red:    '#ef4444',
  orange: '#fb923c',
  green:  '#22c55e',
};
const TEMP_LABELS: Record<'red' | 'orange' | 'green', string> = {
  red:    'Ainda não',
  orange: 'Em progresso',
  green:  'Sim, tenho isso',
};

function TempSquare({ temp, selected, onClick }: {
  temp: 'red' | 'orange' | 'green';
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      title={TEMP_LABELS[temp]}
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        backgroundColor: TEMP_COLORS[temp],
        opacity: selected ? 1 : 0.28,
        outline: selected ? '2px solid white' : 'none',
        outlineOffset: 1,
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        transition: 'all 0.15s',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    />
  );
}

export default function SuaJornadaPage() {
  const [auditState, setAuditState] = useState<AuditState>(loadAuditState);

  const setTemp = (code: string, temp: 'red' | 'orange' | 'green') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditState(prev => {
      const next = { ...prev, [code]: prev[code] === temp ? null : temp };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 pb-16">

        <div>
          <h1 className="text-2xl font-bold text-foreground">Sua Jornada</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Marque sua temperatura em cada módulo — passe o mouse para ver a descrição.
          </p>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/70">Temperatura:</span>
          {(['red', 'orange', 'green'] as const).map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 h-4 rounded-sm"
                style={{ backgroundColor: TEMP_COLORS[t] }}
              />
              {TEMP_LABELS[t]}
            </span>
          ))}
        </div>

        {/* ── Roadmap Core Business® ────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden bg-black"
          style={{ border: '2px solid rgba(139,92,246,0.4)' }}
        >
          {/* Header da marca */}
          <div className="flex items-start justify-between px-5 pt-4 pb-3">
            <div>
              <p className="text-white font-black text-lg leading-none tracking-tight">
                CORE<br />BUSINESS®
              </p>
              <p className="text-white/40 text-[10px] mt-1 tracking-wider">made for creator founders.</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-xs tracking-widest uppercase">Loulou</p>
              <p className="text-white/40 text-[10px] tracking-widest uppercase">Studios</p>
            </div>
          </div>

          {/* Cabeçalho das colunas */}
          <div className="flex" style={{ borderTop: '1px solid rgba(55,65,81,0.7)' }}>
            <div className="w-10 shrink-0" style={{ borderRight: '1px solid rgba(55,65,81,0.7)' }} />
            {['ATRAIR', 'EDUCAR', 'CONVIDAR', 'ENCANTAR'].map(cat => (
              <div
                key={cat}
                className="flex-1 text-center py-2.5 text-white font-bold text-xs uppercase tracking-[0.15em]"
                style={{ borderLeft: '1px solid rgba(55,65,81,0.7)' }}
              >
                {cat}
              </div>
            ))}
          </div>

          {/* Grid principal */}
          <div className="flex" style={{ borderTop: '1px solid rgba(55,65,81,0.7)' }}>

            {/* Labels laterais >20k / <20k */}
            <div
              className="w-10 shrink-0 flex flex-col"
              style={{ borderRight: '1px solid rgba(55,65,81,0.7)' }}
            >
              {/* >20k — 3 linhas */}
              <div
                className="flex items-center justify-center"
                style={{ flex: 3, borderBottom: '2px solid rgba(139,92,246,0.5)' }}
              >
                <span
                  className="font-bold text-[11px] whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#c4b5fd', letterSpacing: '0.1em' }}
                >
                  &gt;20k/mês
                </span>
              </div>
              {/* <20k — 3 linhas */}
              <div className="flex items-center justify-center" style={{ flex: 3 }}>
                <span
                  className="font-bold text-[11px] whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#fdba74', letterSpacing: '0.1em' }}
                >
                  &lt;20k/mês
                </span>
              </div>
            </div>

            {/* Células 4×6 */}
            <div className="flex-1 grid grid-cols-4">
              {GRID_ROWS.map((row, rowIdx) =>
                row.map((cell) => {
                  const isAbove = cell.level === 'above20k';
                  const isSeparator = rowIdx === 2;
                  const badgeBg = isAbove ? '#7c3aed' : '#ea580c';

                  return (
                    <div
                      key={cell.code}
                      className="flex flex-col"
                      style={{
                        borderRight: '1px solid rgba(55,65,81,0.7)',
                        borderBottom: isSeparator
                          ? '2px solid rgba(139,92,246,0.5)'
                          : '1px solid rgba(55,65,81,0.7)',
                      }}
                    >
                      {/* Badge: código + nome */}
                      <div
                        className="px-2 py-1.5"
                        style={{ backgroundColor: badgeBg }}
                        title={cell.desc}
                      >
                        <p className="font-mono font-black text-[11px] text-white leading-none">
                          {cell.code}
                        </p>
                        <p
                          className="text-white/90 leading-tight mt-1"
                          style={{ fontSize: 9, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {cell.name}
                        </p>
                      </div>

                      {/* Área branca com os 3 quadrados */}
                      <div
                        className="flex-1 flex items-center justify-center gap-1.5 bg-white"
                        style={{ minHeight: 38, padding: '6px 4px' }}
                      >
                        {(['red', 'orange', 'green'] as const).map(t => (
                          <TempSquare
                            key={t}
                            temp={t}
                            selected={auditState[cell.code] === t}
                            onClick={setTemp(cell.code, t)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
