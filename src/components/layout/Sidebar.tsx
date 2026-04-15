import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  Moon,
  Newspaper,
  PanelLeft,
  Pencil,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import gemzLogo from "@/assets/gemz-logo.png";
import { useChatStore } from "@/stores/chatStore";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import SearchModal from "@/components/modals/SearchModal";
import DocumentsModal from "@/components/modals/DocumentsModal";
import ProfileSettingsModal from "@/components/profile/ProfileSettingsModal";
import { deletePersistedConversation, loadPersistedConversations } from "@/services/chatPersistenceService";

export default function Sidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    hydrateConversations,
    clearConversations,
    setActivePage,
    activePage,
  } = useChatStore();

  const { user, activeTenant, tenants, isAdmin, signOut } = useAuth();
  const isMobile = useIsMobile();
  const isAdminMode = isAdmin;

  const [searchOpen, setSearchOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const recentConversations = conversations.slice(0, 20);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (isAdminMode) {
        clearConversations();
        return;
      }

      if (!user?.id || !activeTenant?.id) {
        clearConversations();
        return;
      }

      try {
        const data = await loadPersistedConversations({
          userId: user.id,
          tenantId: activeTenant.id,
        });
        if (!cancelled) hydrateConversations(data);
      } catch (error) {
        console.error("Falha ao carregar historico de chat:", error);
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeTenant?.id, hydrateConversations, clearConversations, isAdminMode]);

  useEffect(() => {
    if (isAdminMode) return;

    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdminMode]);

  if (!sidebarOpen) {
    if (!isAdminMode) {
      return <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />;
    }
    return null;
  }

  const sidebarContent = (
    <aside className={`${isMobile ? "w-full" : "w-[280px]"} h-screen bg-card flex flex-col shrink-0`}>
      <div className="h-12 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <img src={gemzLogo} alt="Gemz AI" className="w-[18px] h-[18px] rounded-sm" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Fechar barra lateral"
            aria-label="Fechar barra lateral"
          >
            {isMobile ? (
              <X className="w-[18px] h-[18px] text-muted-foreground" />
            ) : (
              <PanelLeft className="w-[18px] h-[18px] text-muted-foreground" />
            )}
          </button>
        </div>

        {!isAdminMode && (
          <button
            onClick={() => {
              setActiveConversation(null);
              setActivePage("home");
            }}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Novo chat"
            aria-label="Novo chat"
          >
            <Pencil className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="px-2 space-y-0.5">
        {!isAdminMode && (
          <>
            <NavItem
              icon={<Home className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Inicio"
              active={activePage === "home"}
              onClick={() => {
                setActivePage("home");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<Boxes className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="CreatorFounder Kit"
              active={activePage === "creator-kit"}
              onClick={() => {
                setActivePage("creator-kit");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<FlaskConical className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Pesquisa de Mercado"
              active={activePage === "market-research"}
              onClick={() => {
                setActivePage("market-research");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem icon={<Search className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Buscar" onClick={() => setSearchOpen(true)} />
            <NavItem
              icon={<GraduationCap className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Aulas"
              active={activePage === "aulas"}
              onClick={() => {
                setActivePage("aulas");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Calendario"
              active={activePage === "calendario"}
              onClick={() => {
                setActivePage("calendario");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem icon={<BookOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Documentos" onClick={() => setDocsOpen(true)} />
            <NavItem
              icon={<ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Implementacao"
              active={activePage === "implementation"}
              onClick={() => {
                setActivePage("implementation");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Metricas"
              active={activePage === "metrics"}
              onClick={() => {
                setActivePage("metrics");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<Newspaper className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="News Feed"
              active={activePage === "news-feed"}
              onClick={() => {
                setActivePage("news-feed");
                if (isMobile) setSidebarOpen(false);
              }}
            />
          </>
        )}

        {isAdminMode && (
          <>
            <div className="px-3 pt-2 pb-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Administracao</span>
            </div>
            <NavItem
              icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Insights e Saude"
              active={activePage === "admin" || activePage === "admin-insights"}
              onClick={() => {
                setActivePage("admin-insights");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Gestao Global"
              active={activePage === "admin-global"}
              onClick={() => {
                setActivePage("admin-global");
                if (isMobile) setSidebarOpen(false);
              }}
            />
            <NavItem
              icon={<Users className="w-[18px] h-[18px]" strokeWidth={1.5} />}
              label="Tenants e Usuarios"
              active={activePage === "admin-access"}
              onClick={() => {
                setActivePage("admin-access");
                if (isMobile) setSidebarOpen(false);
              }}
            />
          </>
        )}
      </div>

      {!isAdminMode && (
        <div className="flex-1 overflow-y-auto px-2 mt-2 space-y-4">
          <div>
            <span className="px-3 text-xs font-medium text-muted-foreground">Conversas</span>
            <div className="mt-1 space-y-0.5">
              {recentConversations.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum chat salvo ainda.</p>
              )}

              {recentConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`w-full flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                    activeConversationId === conversation.id ? "bg-secondary" : "hover:bg-secondary"
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveConversation(conversation.id);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className="min-w-0 flex-1 flex items-center gap-2 px-1 py-1 text-left"
                    aria-label={`Abrir conversa ${conversation.title}`}
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{conversation.title}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const confirmed = window.confirm("Deseja excluir este chat?");
                      if (!confirmed) return;
                      deleteConversation(conversation.id);
                      if (user?.id && activeTenant?.id) {
                        void deletePersistedConversation({
                          conversationId: conversation.id,
                          userId: user.id,
                          tenantId: activeTenant.id,
                        }).catch((error) => {
                          console.error("Falha ao excluir conversa no banco:", error);
                        });
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-background/60 transition-colors shrink-0"
                    title="Excluir chat"
                    aria-label="Excluir chat"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="p-2 border-t border-border mt-auto">
        <div className="w-full px-2 py-2 space-y-1.5">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 min-w-0 rounded-lg px-2 py-1.5 hover:bg-secondary transition-colors"
            title="Configurar perfil"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-sm font-semibold">{user?.name?.slice(0, 1).toUpperCase() || "U"}</span>
              </div>
            )}

            <div className="min-w-0 text-left flex-1">
              <p className="text-sm font-medium text-foreground truncate" title={user?.name || "Usuario"}>{user?.name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground truncate" title={activeTenant?.name || tenants[0]?.name || "Sem tenant"}>
                {activeTenant?.name || tenants[0]?.name || "Sem tenant"}
              </p>
            </div>
          </button>

          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
              aria-label="Configurar perfil"
              title="Configurar perfil"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </button>

            <ThemeToggle />

            <button
              type="button"
              onClick={() => void signOut()}
              className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {isMobile ? (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 max-w-[300px]">{sidebarContent}</div>
        </>
      ) : (
        sidebarContent
      )}

      {!isAdminMode && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {!isAdminMode && <DocumentsModal open={docsOpen} onClose={() => setDocsOpen(false)} />}
      <ProfileSettingsModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function NavItem({
  icon,
  label,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${active ? "bg-secondary" : "hover:bg-secondary"}`}
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
      aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Moon className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}
