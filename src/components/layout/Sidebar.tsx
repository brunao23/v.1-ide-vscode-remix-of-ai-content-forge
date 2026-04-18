import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useImplementationStore } from "@/stores/implementationStore";
import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  Home,
  Map,
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
import type { AppUser } from "@/contexts/AuthContext";
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

  const { checkedCount, totalCount } = useImplementationStore();
  const implementationPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
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
        const data = await loadPersistedConversations({ userId: user.id, tenantId: activeTenant.id });
        if (!cancelled) hydrateConversations(data);
      } catch (error) {
        console.error("Falha ao carregar historico de chat:", error);
      }
    };
    void loadHistory();
    return () => { cancelled = true; };
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

  const navigate = (page: string) => {
    setActivePage(page);
    if (isMobile) setSidebarOpen(false);
  };

  const modals = (
    <>
      {!isAdminMode && <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />}
      {!isAdminMode && <DocumentsModal open={docsOpen} onClose={() => setDocsOpen(false)} />}
      <ProfileSettingsModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );

  // ─── Mobile: overlay ────────────────────────────────────────────────────────
  if (isMobile) {
    if (!sidebarOpen) return modals;
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 z-50 w-[280px]">
          <ExpandedSidebar
            isAdminMode={isAdminMode}
            activePage={activePage}
            navigate={navigate}
            recentConversations={recentConversations}
            activeConversationId={activeConversationId}
            setActiveConversation={setActiveConversation}
            deleteConversation={deleteConversation}
            user={user}
            activeTenant={activeTenant}
            tenants={tenants}
            checkedCount={checkedCount}
            totalCount={totalCount}
            implementationPercent={implementationPercent}
            onCollapse={() => setSidebarOpen(false)}
            onNewChat={() => { setActiveConversation(null); setActivePage("home"); if (isMobile) setSidebarOpen(false); }}
            onSearch={() => setSearchOpen(true)}
            onDocs={() => setDocsOpen(true)}
            onProfile={() => setProfileOpen(true)}
            signOut={signOut}
            isMobile
          />
        </div>
        {modals}
      </>
    );
  }

  // ─── Desktop: colapsado (slim bar de ícones) ─────────────────────────────────
  if (!sidebarOpen) {
    return (
      <>
        <aside className="w-[52px] h-screen bg-card flex flex-col shrink-0 border-r border-border">
          {/* Botão de expandir */}
          <div className="h-12 flex items-center justify-center shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Expandir menu"
              aria-label="Expandir menu"
            >
              <PanelLeft className="w-[18px] h-[18px] text-muted-foreground rotate-180" />
            </button>
          </div>

          {/* Ícones de navegação */}
          <nav className="px-1.5 space-y-0.5 flex-1 overflow-y-auto">
            {!isAdminMode && (
              <>
                <SlimNavItem icon={<Home className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Início" active={activePage === "home"} onClick={() => setActivePage("home")} />
                <SlimNavItem icon={<Boxes className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="CreatorFounder Kit" active={activePage === "creator-kit"} onClick={() => setActivePage("creator-kit")} />
                <SlimNavItem icon={<FlaskConical className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Pesquisa de Mercado" active={activePage === "market-research"} onClick={() => setActivePage("market-research")} />
                <SlimNavItem icon={<GraduationCap className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Aulas" active={activePage === "aulas"} onClick={() => setActivePage("aulas")} />
                <SlimNavItem icon={<Map className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Sua Jornada" active={activePage === "jornada"} onClick={() => setActivePage("jornada")} />
                <SlimNavItem icon={<CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Calendário" active={activePage === "calendario"} onClick={() => setActivePage("calendario")} />
                <SlimNavItem icon={<BookOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Documentos" onClick={() => setDocsOpen(true)} />
                <SlimNavItem icon={<ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Implementação" active={activePage === "implementation"} onClick={() => setActivePage("implementation")} />
                <SlimNavItem icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Métricas" active={activePage === "metrics"} onClick={() => setActivePage("metrics")} />
                <SlimNavItem icon={<Newspaper className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="News Feed" active={activePage === "news-feed"} onClick={() => setActivePage("news-feed")} />
              </>
            )}
            {isAdminMode && (
              <>
                <SlimNavItem icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Insights e Saúde" active={activePage === "admin-insights" || activePage === "admin"} onClick={() => setActivePage("admin-insights")} />
                <SlimNavItem icon={<ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Gestão Global" active={activePage === "admin-global"} onClick={() => setActivePage("admin-global")} />
                <SlimNavItem icon={<Users className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Tenants e Usuários" active={activePage === "admin-access"} onClick={() => setActivePage("admin-access")} />
              </>
            )}
          </nav>

          {/* Rodapé do slim bar */}
          <div className="px-1.5 pb-2 pt-2 border-t border-border space-y-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary transition-colors"
              title={user?.name || "Perfil"}
              aria-label="Perfil"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-xs font-semibold">
                    {user?.name?.slice(0, 1).toUpperCase() || "U"}
                  </span>
                </div>
              )}
            </button>
            <ThemeToggle slim />
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </aside>
        {modals}
      </>
    );
  }

  // ─── Desktop: expandido ───────────────────────────────────────────────────────
  return (
    <>
      <ExpandedSidebar
        isAdminMode={isAdminMode}
        activePage={activePage}
        navigate={navigate}
        recentConversations={recentConversations}
        activeConversationId={activeConversationId}
        setActiveConversation={setActiveConversation}
        deleteConversation={deleteConversation}
        user={user}
        activeTenant={activeTenant}
        tenants={tenants}
        checkedCount={checkedCount}
        totalCount={totalCount}
        implementationPercent={implementationPercent}
        onCollapse={() => setSidebarOpen(false)}
        onNewChat={() => { setActiveConversation(null); setActivePage("home"); }}
        onSearch={() => setSearchOpen(true)}
        onDocs={() => setDocsOpen(true)}
        onProfile={() => setProfileOpen(true)}
        signOut={signOut}
        isMobile={false}
      />
      {modals}
    </>
  );
}

// ─── Sidebar expandido (desktop + mobile overlay) ─────────────────────────────
function ExpandedSidebar({
  isAdminMode,
  activePage,
  navigate,
  recentConversations,
  activeConversationId,
  setActiveConversation,
  deleteConversation,
  user,
  activeTenant,
  tenants,
  checkedCount,
  totalCount,
  implementationPercent,
  onCollapse,
  onNewChat,
  onSearch,
  onDocs,
  onProfile,
  signOut,
  isMobile,
}: {
  isAdminMode: boolean;
  activePage: string;
  navigate: (page: string) => void;
  recentConversations: { id: string; title: string }[];
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  user: AppUser | null;
  activeTenant: { name?: string } | null;
  tenants: { name?: string }[];
  checkedCount: number;
  totalCount: number;
  implementationPercent: number;
  onCollapse: () => void;
  onNewChat: () => void;
  onSearch: () => void;
  onDocs: () => void;
  onProfile: () => void;
  signOut: () => void;
  isMobile: boolean;
}) {
  return (
    <aside className="w-[280px] h-screen bg-card flex flex-col shrink-0 border-r border-border">
      {/* Header */}
      <div className="h-12 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <img src={gemzLogo} alt="Gemz AI" className="w-[18px] h-[18px] rounded-sm shrink-0" />
        </div>
        <div className="flex items-center gap-0.5">
          {!isAdminMode && (
            <button
              onClick={onNewChat}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Novo chat"
              aria-label="Novo chat"
            >
              <Pencil className="w-[18px] h-[18px] text-muted-foreground" />
            </button>
          )}
          <button
            onClick={onCollapse}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title={isMobile ? "Fechar menu" : "Recolher menu"}
            aria-label={isMobile ? "Fechar menu" : "Recolher menu"}
          >
            {isMobile ? (
              <X className="w-[18px] h-[18px] text-muted-foreground" />
            ) : (
              <PanelLeft className="w-[18px] h-[18px] text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Navegação */}
      <div className="px-2 space-y-0.5 shrink-0">
        {!isAdminMode && (
          <>
            <NavItem icon={<Home className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Início" active={activePage === "home"} onClick={() => navigate("home")} />
            <NavItem icon={<Boxes className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="CreatorFounder Kit" active={activePage === "creator-kit"} onClick={() => navigate("creator-kit")} />
            <NavItem icon={<FlaskConical className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Pesquisa de Mercado" active={activePage === "market-research"} onClick={() => navigate("market-research")} />
            <NavItem icon={<GraduationCap className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Aulas" active={activePage === "aulas"} onClick={() => navigate("aulas")} />
            <NavItem icon={<Map className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Sua Jornada" active={activePage === "jornada"} onClick={() => navigate("jornada")} />
            <NavItem icon={<CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Calendário" active={activePage === "calendario"} onClick={() => navigate("calendario")} />
            <NavItem icon={<BookOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Documentos" onClick={onDocs} />
            <NavItem icon={<ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Implementação" active={activePage === "implementation"} onClick={() => navigate("implementation")} />
            <NavItem icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Métricas" active={activePage === "metrics"} onClick={() => navigate("metrics")} />
            <NavItem icon={<Newspaper className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="News Feed" active={activePage === "news-feed"} onClick={() => navigate("news-feed")} />
          </>
        )}
        {isAdminMode && (
          <>
            <div className="px-3 pt-2 pb-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Administração</span>
            </div>
            <NavItem icon={<BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Insights e Saúde" active={activePage === "admin" || activePage === "admin-insights"} onClick={() => navigate("admin-insights")} />
            <NavItem icon={<ShieldCheck className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Gestão Global" active={activePage === "admin-global"} onClick={() => navigate("admin-global")} />
            <NavItem icon={<Users className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Tenants e Usuários" active={activePage === "admin-access"} onClick={() => navigate("admin-access")} />
          </>
        )}
      </div>

      {/* Conversas e progresso */}
      {!isAdminMode && (
        <div className="flex-1 overflow-y-auto px-2 mt-2 space-y-4 min-h-0">
          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => navigate("implementation")}
              className="w-full px-3 py-3 rounded-xl bg-secondary/60 hover:bg-secondary transition-colors text-left"
              title="Ver checklist de implementação"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Meu Progresso</span>
                <span className="text-xs font-bold text-emerald-500">{implementationPercent}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-background overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${implementationPercent}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {checkedCount} de {totalCount} tarefas concluídas
              </p>
            </button>
          )}

          <div>
            <button
              onClick={onSearch}
              className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/60 transition-colors text-left"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">Buscar conversas...</span>
              <span className="ml-auto text-[10px] text-muted-foreground/50">⌘K</span>
            </button>
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
                    onClick={() => { setActiveConversation(conversation.id); if (isMobile) {} }}
                    className="min-w-0 flex-1 flex items-center gap-2 px-1 py-1 text-left"
                    aria-label={`Abrir conversa ${conversation.title}`}
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{conversation.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm("Deseja excluir este chat?")) return;
                      deleteConversation(conversation.id);
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

      {/* Rodapé */}
      <div className="p-2 border-t border-border mt-auto shrink-0">
        <div className="w-full px-2 py-2 space-y-1.5">
          <button
            type="button"
            onClick={onProfile}
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
              <p className="text-sm font-medium text-foreground truncate" title={user?.name || "Usuário"}>{user?.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate" title={activeTenant?.name || tenants[0]?.name || "Sem tenant"}>
                {activeTenant?.name || tenants[0]?.name || "Sem tenant"}
              </p>
            </div>
          </button>
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={onProfile}
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
}

// ─── NavItem (expandido) ──────────────────────────────────────────────────────
function NavItem({ icon, label, onClick, active }: { icon: ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${active ? "bg-secondary" : "hover:bg-secondary"}`}
      aria-label={label}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-sm text-foreground truncate">{label}</span>
    </button>
  );
}

// ─── SlimNavItem (colapsado, só ícone) ────────────────────────────────────────
function SlimNavItem({ icon, label, onClick, active }: { icon: ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-colors ${active ? "bg-secondary" : "hover:bg-secondary"}`}
      title={label}
      aria-label={label}
    >
      <span className="text-muted-foreground">{icon}</span>
    </button>
  );
}

// ─── ThemeToggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ slim }: { slim?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={`${slim ? "w-full flex items-center justify-center" : ""} p-2 rounded-lg hover:bg-secondary transition-colors shrink-0`}
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
