import { Check, AlertCircle } from 'lucide-react';
import { AGENTS } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DocumentStatusBadgeProps {
  agentId: string;
  completedDocs: Record<string, boolean>;
}

const AGENT_DOC_LABELS: Record<string, string> = {
  'brand-book': 'Brand Book',
  'market-research': 'Pesquisa de Mercado',
  'icp-architect': 'Mapa do ICP',
  'pillar-strategist': 'Pilares de Conteúdo',
  'matrix-generator': 'Matriz de Conteúdo',
  'diretora-criativa': 'Calendário Mensal',
  'scriptwriter': 'Roteiro de Vídeo',
};

export default function DocumentStatusBadge({ agentId, completedDocs }: DocumentStatusBadgeProps) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent || agent.requires.length === 0) return null;

  const total = agent.requires.length;
  const done = agent.requires.filter((r) => completedDocs[r]).length;
  const allReady = done === total;

  return (
    <TooltipProvider delayDuration={200}>
      {/* SVG Filter for liquid glass distortion */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="glass-distortion-badge" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04 0.04"
              numOctaves="2"
              seed="42"
              result="noise"
            />
            <feGaussianBlur
              in="noise"
              stdDeviation="1.5"
              result="blurred"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurred"
              scale="12"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id="glass-distortion-tooltip" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.025 0.025"
              numOctaves="2"
              seed="92"
              result="noise"
            />
            <feGaussianBlur
              in="noise"
              stdDeviation="2"
              result="blurred"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurred"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="liquid-glass-badge" style={{ position: 'relative', isolation: 'isolate' }}>
            {/* Glass distortion pseudo-layers via wrapper */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 8px -2px rgba(255, 255, 255, 0.5)',
                zIndex: 0,
              }}
            />
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                filter: 'url(#glass-distortion-badge)',
                WebkitFilter: 'url(#glass-distortion-badge)',
                zIndex: -1,
                borderRadius: 'inherit',
              }}
            />
            <div
              className="relative z-10 inline-flex items-center gap-1.5 px-4 py-2 rounded-full cursor-default transition-all duration-300 hover:scale-105"
              style={{
                boxShadow: allReady
                  ? '0px 0px 14px -6px rgba(16, 163, 127, 0.4)'
                  : '0px 0px 14px -6px rgba(255, 255, 255, 0.25)',
              }}
            >
              {allReady ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
              )}
              <span
                className={`text-xs font-medium ${allReady ? 'text-primary' : 'text-foreground'}`}
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
              >
                {allReady ? 'Pronto' : `${done}/${total} pendentes`}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="p-0 border-0 bg-transparent shadow-none rounded-2xl"
          sideOffset={8}
        >
          <div
            className="liquid-glass-tooltip rounded-2xl max-w-[220px]"
            style={{ position: 'relative', isolation: 'isolate' }}
          >
            {/* Inner glow layer */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 12px -2px rgba(255, 255, 255, 0.6)',
                zIndex: 0,
              }}
            />
            {/* Backdrop blur + distortion layer */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                filter: 'url(#glass-distortion-tooltip)',
                WebkitFilter: 'url(#glass-distortion-tooltip)',
                zIndex: -1,
              }}
            />
            {/* Content */}
            <div className="relative z-10 p-4">
              <p
                className="text-xs font-semibold text-foreground mb-2.5"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
              >
                Documentos necessários
              </p>
              <div className="space-y-1.5">
                {agent.requires.map((reqId) => {
                  const isReady = completedDocs[reqId];
                  return (
                    <div key={reqId} className="flex items-center gap-2">
                      {isReady ? (
                        <Check className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" />
                      )}
                      <span
                        className={`text-xs ${isReady ? 'text-muted-foreground' : 'text-foreground font-medium'}`}
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                      >
                        {AGENT_DOC_LABELS[reqId] || reqId}
                      </span>
                      {!isReady && (
                        <span className="text-[10px] text-yellow-500 ml-auto">Pendente</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
