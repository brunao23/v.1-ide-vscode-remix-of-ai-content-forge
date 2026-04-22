import { useState, useMemo } from 'react';
import { AGENTS, AGENT_AVATARS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { ChevronDown, Search, Lock } from 'lucide-react';
import Header from '@/components/layout/Header';
import { useUserDocuments } from '@/hooks/useUserDocuments';
import { getMissingDocTypes } from '@/lib/documentGate';

const SECTIONS = [
  {
    title: 'Vendas e Produto',
    description: 'Construa a base estratégica do seu negócio',
    agentIds: ['brand-book', 'market-research', 'icp-architect', 'expert-social-selling', 'criador-documento-oferta'],
  },
  {
    title: 'Estratégia e Sistemas',
    description: 'Ferramentas de estratégia e automação para escalar',
    agentIds: ['amanda-ai', 'arquiteta-perfil-icp', 'programa-rivotril', 'estrategias-sprint-20k', 'arquiteta-workshops'],
  },
  {
    title: 'Conteúdo',
    description: 'Crie e gerencie sua estratégia de conteúdo',
    agentIds: ['pillar-strategist', 'matrix-generator', 'diretora-criativa', 'scriptwriter', 'feedback-conteudo', 'copywriter-campanhas', 'vsl-invisivel', 'voz-de-marca'],
  },
];

export default function CreatorKitPage() {
  const { setActiveAgent } = useChatStore();
  const { existingTypes, isLoading: docsLoading } = useUserDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map(s => [s.title, true]))
  );

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.map(section => ({
      ...section,
      agentIds: section.agentIds.filter(id => {
        const agent = AGENTS.find(a => a.id === id);
        return agent && (agent.name.toLowerCase().includes(q) || agent.description.toLowerCase().includes(q));
      }),
    })).filter(section => section.agentIds.length > 0);
  }, [searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">
              CreatorFounder™️ Kit
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os agentes organizados por etapa do seu negócio.
            </p>

            {/* Search bar */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar agentes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {filteredSections.map((section) => {
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
                      {sectionAgents.map((agent, idx) => {
                        const isLocked = !docsLoading && getMissingDocTypes(agent!, existingTypes).length > 0;
                        return (
                          <button
                            key={agent!.id}
                            onClick={() => setActiveAgent(agent!.id)}
                            className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors cursor-pointer text-left ${
                              idx < sectionAgents.length - 1 ? 'border-b border-border' : ''
                            } ${isLocked ? 'opacity-60' : ''}`}
                          >
                            <div className="relative shrink-0">
                              <img
                                src={AGENT_AVATARS[agent!.id]}
                                alt={agent!.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                              {isLocked && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center">
                                  <Lock className="w-2.5 h-2.5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
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
                        );
                      })}
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
