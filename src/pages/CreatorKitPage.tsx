import { useState } from 'react';
import { AGENTS, AGENT_AVATARS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { ChevronDown } from 'lucide-react';
import Header from '@/components/layout/Header';

const SECTIONS = [
  {
    title: 'Vendas e Produto',
    description: 'Construa a base estratégica do seu negócio',
    agentIds: ['brand-book', 'market-research', 'icp-architect'],
  },
  {
    title: 'Conteúdo',
    description: 'Crie e gerencie sua estratégia de conteúdo',
    agentIds: ['pillar-strategist', 'matrix-generator', 'marketing-manager', 'scriptwriter'],
  },
];

export default function CreatorKitPage() {
  const { setActiveAgent } = useChatStore();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.title, true]))
  );

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              CreatorFounder™️ Kit
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os agentes organizados por etapa do seu negócio.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const isOpen = openSections[section.title];
              const sectionAgents = section.agentIds
                .map(id => AGENTS.find(a => a.id === id))
                .filter(Boolean);

              return (
                <div key={section.title} className="rounded-xl border border-border bg-card overflow-hidden">
                  {/* Section header - clickable */}
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className="text-left">
                      <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {/* Agent list */}
                  {isOpen && (
                    <div className="border-t border-border">
                      {sectionAgents.map((agent, idx) => (
                        <button
                          key={agent!.id}
                          onClick={() => setActiveAgent(agent!.id)}
                          className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors cursor-pointer text-left ${
                            idx < sectionAgents.length - 1 ? 'border-b border-border' : ''
                          }`}
                        >
                          <img
                            src={AGENT_AVATARS[agent!.id]}
                            alt={agent!.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{agent!.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {agent!.description}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                            {agent!.recommendedModel}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
