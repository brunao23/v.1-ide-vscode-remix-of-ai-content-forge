import { Lock } from 'lucide-react';
import { Agent, AGENTS, AGENT_AVATARS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { DOC_TYPE_TO_AGENT } from '@/lib/documentGate';

interface Props {
  agent: Agent;
  missingDocTypes: string[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  'brand-book': 'Brand Book',
  'pesquisa': 'Pesquisa de Mercado',
  'icp': 'Mapa do ICP',
  'pilares': 'Pilares de Conteúdo',
  'matriz': 'Matriz de Conteúdo',
  'calendario': 'Calendário Editorial',
  'roteiro': 'Roteiro de Vídeo',
};

export default function DocumentGateBlock({ agent, missingDocTypes }: Props) {
  const { setActiveAgent } = useChatStore();

  const firstMissingAgentId = DOC_TYPE_TO_AGENT[missingDocTypes[0]];
  const firstMissingAgent = AGENTS.find(a => a.id === firstMissingAgentId);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground">Complete sua base estratégica</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Para usar <strong>{agent.name}</strong>, crie primeiro:
          </p>
        </div>

        <ul className="text-left space-y-2">
          {missingDocTypes.map(type => {
            const reqAgentId = DOC_TYPE_TO_AGENT[type];
            const reqAgent = AGENTS.find(a => a.id === reqAgentId);
            return (
              <li
                key={type}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
              >
                {reqAgent && (
                  <img
                    src={AGENT_AVATARS[reqAgent.id]}
                    alt={reqAgent.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {DOC_TYPE_LABELS[type] || type}
                  </p>
                  <p className="text-xs text-muted-foreground">{reqAgent?.name}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {firstMissingAgent && (
          <button
            onClick={() => setActiveAgent(firstMissingAgent.id)}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Começar com {firstMissingAgent.name} →
          </button>
        )}
      </div>
    </div>
  );
}
