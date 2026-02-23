import { Check, AlertCircle } from 'lucide-react';
import { AGENTS } from '@/types';

interface DocumentStatusBadgeProps {
  agentId: string;
  /** Map of agentId -> true if that agent's document exists */
  completedDocs: Record<string, boolean>;
}

export default function DocumentStatusBadge({ agentId, completedDocs }: DocumentStatusBadgeProps) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent || agent.requires.length === 0) return null;

  const total = agent.requires.length;
  const done = agent.requires.filter((r) => completedDocs[r]).length;
  const allReady = done === total;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-sm ${
        allReady
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400'
      }`}
      title={`${done} de ${total} documentos carregados`}
    >
      {allReady ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      <span className="text-xs font-medium">
        {allReady ? 'Pronto' : `${done}/${total} pendentes`}
      </span>
    </div>
  );
}
