import { useState } from 'react';
import { AGENTS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { useTheme } from '@/hooks/useTheme';
import { PanelLeft, Pencil, Search, Image, AppWindow, BookOpen, MessageSquare, Sun, Moon, X } from 'lucide-react';
import SearchModal from '@/components/modals/SearchModal';
import ImagesModal from '@/components/modals/ImagesModal';
import AppsModal from '@/components/modals/AppsModal';
import DocumentsModal from '@/components/modals/DocumentsModal';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, activeAgentId, setActiveAgent, conversations, activeConversationId, setActiveConversation } = useChatStore();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const agentConversations = conversations.filter(c => c.agentId === activeAgentId);
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
      {/* Header */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2 px-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">C</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveConversation(null)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Novo chat"
            aria-label="Novo chat"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Fechar sidebar"
            aria-label="Fechar sidebar"
          >
            {isMobile ? <X className="w-4 h-4 text-muted-foreground" /> : <PanelLeft className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Nav items */}
      <div className="px-2 space-y-0.5">
        <NavItem icon={<Search className="w-[18px] h-[18px]" />} label="Buscar" onClick={() => setSearchOpen(true)} />
        <NavItem icon={<Image className="w-[18px] h-[18px]" />} label="Imagens" onClick={() => setImagesOpen(true)} />
        <NavItem icon={<AppWindow className="w-[18px] h-[18px]" />} label="Aplicativos" onClick={() => setAppsOpen(true)} />
        <NavItem icon={<BookOpen className="w-[18px] h-[18px]" />} label="Documentos" onClick={() => setDocsOpen(true)} />
      </div>

      {/* Agents Section */}
      <div className="mt-4 px-2">
        <span className="px-3 text-xs font-medium text-muted-foreground tracking-wide uppercase">Agentes</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 mt-2 space-y-0.5">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => { setActiveAgent(agent.id); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeAgentId === agent.id ? 'bg-secondary' : 'hover:bg-secondary'
            }`}
            aria-label={agent.name}
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ background: agent.color + '22' }}>
              {agent.emoji}
            </span>
            <span className="text-sm text-foreground truncate">{agent.name}</span>
          </button>
        ))}

        {/* Recent conversations */}
        {recentConversations.length > 0 && (
          <div className="mt-4">
            <span className="px-3 text-xs font-medium text-muted-foreground tracking-wide uppercase">Conversas</span>
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

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-sm font-semibold">U</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">Usuário</p>
              <p className="text-xs text-muted-foreground">Pro</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </button>
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

function NavItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
      aria-label={label}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}
