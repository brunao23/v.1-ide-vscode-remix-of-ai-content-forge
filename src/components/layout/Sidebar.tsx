import { useState } from 'react';
import gemzLogo from '@/assets/gemz-logo.png';
import { AGENTS, AGENT_AVATARS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { PanelLeft, Pencil, Search, Image, AppWindow, BookOpen, MessageSquare, X, FlaskConical, Sun, Moon, Home, Boxes, ClipboardCheck, GraduationCap, BarChart3 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import SearchModal from '@/components/modals/SearchModal';
import ImagesModal from '@/components/modals/ImagesModal';
import AppsModal from '@/components/modals/AppsModal';
import DocumentsModal from '@/components/modals/DocumentsModal';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, activeAgentId, setActiveAgent, conversations, activeConversationId, setActiveConversation, setActivePage, activePage } = useChatStore();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const recentConversations = conversations.slice(0, 5);

  // Cmd+K handler
  useState(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!sidebarOpen) return (
    <>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );

  const sidebarContent = (
    <aside className={`${isMobile ? 'w-full' : 'w-[260px]'} h-screen bg-card flex flex-col shrink-0`}>
      {/* Header - just toggle + new chat */}
      <div className="h-12 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <img src={gemzLogo} alt="Gemz AI" className="w-[18px] h-[18px] rounded-sm" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Fechar barra lateral"
            aria-label="Fechar sidebar"
          >
            {isMobile ? <X className="w-[18px] h-[18px] text-muted-foreground" /> : <PanelLeft className="w-[18px] h-[18px] text-muted-foreground" />}
          </button>
        </div>
        <button
          onClick={() => { setActiveConversation(null); setActivePage('home'); }}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title="Novo chat"
          aria-label="Novo chat"
        >
          <Pencil className="w-[18px] h-[18px] text-muted-foreground" />
        </button>
      </div>

      {/* Nav items */}
      <div className="px-2 space-y-0.5">
        <NavItem icon={<Home className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Início" active={activePage === 'home'} onClick={() => { setActivePage('home'); if (isMobile) setSidebarOpen(false); }} />
        <NavItem icon={<Boxes className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="CreatorFounder™️ Kit" active={activePage === 'creator-kit'} onClick={() => { setActivePage('creator-kit'); if (isMobile) setSidebarOpen(false); }} />
        <NavItem icon={<FlaskConical className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Pesquisa de Mercado" active={activePage === 'market-research'} onClick={() => { setActivePage('market-research'); if (isMobile) setSidebarOpen(false); }} />
        <NavItem icon={<Search className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Buscar" onClick={() => setSearchOpen(true)} />
        <NavItem icon={<Image className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Imagens" onClick={() => setImagesOpen(true)} />
        <NavItem icon={<AppWindow className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Aplicativos" onClick={() => setAppsOpen(true)} />
        <NavItem icon={<GraduationCap className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Aulas" active={activePage === 'aulas'} onClick={() => { setActivePage('aulas'); if (isMobile) setSidebarOpen(false); }} />
        <NavItem icon={<BookOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Documentos" onClick={() => setDocsOpen(true)} />
        <NavItem icon={<ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Implementação" active={activePage === 'implementation'} onClick={() => { setActivePage('implementation'); if (isMobile) setSidebarOpen(false); }} />
        <NavItem icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Métricas" active={activePage === 'metrics'} onClick={() => { setActivePage('metrics'); if (isMobile) setSidebarOpen(false); }} />
      </div>

      {/* Agents Section - label "GPTs" not "AGENTES" */}
      <div className="mt-4 px-2">
        <span className="px-3 text-xs font-medium text-muted-foreground">Agentes</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 mt-2 space-y-0.5">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => { setActiveAgent(agent.id); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activePage === 'chat' && activeAgentId === agent.id ? 'bg-secondary' : 'hover:bg-secondary'
            }`}
            aria-label={agent.name}
          >
            <img
              src={AGENT_AVATARS[agent.id]}
              alt={agent.name}
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
            <span className="text-sm text-foreground truncate">{agent.name}</span>
          </button>
        ))}

        {/* Recent conversations */}
        {recentConversations.length > 0 && (
          <div className="mt-4">
            <span className="px-3 text-xs font-medium text-muted-foreground">Conversas</span>
            <div className="mt-1 space-y-0.5">
              {recentConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveConversation(conv.id); if (isMobile) setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeConversationId === conv.id ? 'bg-secondary' : 'hover:bg-secondary'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer - avatar + name + theme toggle */}
      <div className="p-2 border-t border-border">
        <div className="w-full flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-sm font-semibold">U</span>
          </div>
          <div className="min-w-0 text-left flex-1">
            <p className="text-sm font-medium text-foreground truncate">Usuário</p>
            <p className="text-xs text-muted-foreground">Pro</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {isMobile ? (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 max-w-[300px]">
            {sidebarContent}
          </div>
        </>
      ) : (
        sidebarContent
      )}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ImagesModal open={imagesOpen} onClose={() => setImagesOpen(false)} />
      <AppsModal open={appsOpen} onClose={() => setAppsOpen(false)} />
      <DocumentsModal open={docsOpen} onClose={() => setDocsOpen(false)} />
    </>
  );
}

function NavItem({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        active ? 'bg-secondary' : 'hover:bg-secondary'
      }`}
      aria-label={label}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
      aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Moon className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}
