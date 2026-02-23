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
  'marketing-manager': 'Calendário Mensal',
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
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-default
              backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_8px_20px_rgba(0,0,0,0.08)]
              ${allReady
                ? 'bg-primary/[0.08] border-primary/20 text-primary'
                : 'bg-yellow-500/[0.08] border-yellow-500/20 text-yellow-600 dark:text-yellow-400'
              }`}
          >
            {allReady ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            <span className="text-xs font-medium">
              {allReady ? 'Pronto' : `${done}/${total} pendentes`}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="p-3 backdrop-blur-xl bg-popover/80 border-border/50 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_12px_28px_rgba(0,0,0,0.15)] rounded-xl max-w-[220px]"
        >
          <p className="text-xs font-semibold text-foreground mb-2">
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
                  <span className={`text-xs ${isReady ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                    {AGENT_DOC_LABELS[reqId] || reqId}
                  </span>
                  {!isReady && (
                    <span className="text-[10px] text-yellow-500 ml-auto">Pendente</span>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
