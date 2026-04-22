import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import MarketResearchPage from '@/pages/MarketResearchPage';
import HomePage from '@/pages/HomePage';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import CreatorKitPage from '@/pages/CreatorKitPage';
import ImplementationPage from '@/pages/ImplementationPage';
import AulasPage from '@/pages/AulasPage';
import MetricsDashboard from '@/pages/MetricsDashboard';
import CalendarPage from '@/pages/CalendarPage';
import NewsFeedPage from '@/pages/NewsFeedPage';
import GemzAIPage from '@/pages/GemzAIPage';
import AdminPage from '@/pages/AdminPage';
import SuaJornadaPage from '@/pages/SuaJornadaPage';
import { useChatStore } from '@/stores/chatStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { Menu } from 'lucide-react';
import { useEffect } from 'react';

export default function Index() {
  const { sidebarOpen, setSidebarOpen, activePage, setActivePage } = useChatStore();
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isAdmin) return;
    if (activePage === 'admin' || activePage === 'admin-insights' || activePage === 'admin-global' || activePage === 'admin-access') return;
    setActivePage('admin-insights');
  }, [isAdmin, activePage, setActivePage]);

  const renderPage = () => {
    if (isAdmin && activePage !== 'admin' && activePage !== 'admin-insights' && activePage !== 'admin-global' && activePage !== 'admin-access') {
      return <AdminPage tab="insights" />;
    }

    switch (activePage) {
      case 'home':
        return <HomePage />;
      case 'market-research':
        return <MarketResearchPage onBack={() => setActivePage('home')} />;
      case 'creator-kit':
        return <CreatorKitPage />;
      case 'implementation':
        return <ImplementationPage />;
      case 'aulas':
        return <AulasPage />;
      case 'jornada':
        return <SuaJornadaPage />;
      case 'metrics':
        return <MetricsDashboard />;
      case 'calendario':
        return <CalendarPage />;
      case 'news-feed':
        return <NewsFeedPage />;
      case 'gemz-ai':
        return <GemzAIPage />;
      case 'admin':
      case 'admin-insights':
        return <AdminPage tab="insights" />;
      case 'admin-global':
        return <AdminPage tab="global" />;
      case 'admin-access':
        return <AdminPage tab="access" />;
      default:
        return <ChatArea />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-30 p-1.5 rounded-lg bg-card border border-border hover:bg-secondary transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-[18px] h-[18px] text-muted-foreground" />
        </button>
      )}
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-hidden">
        {renderPage()}
      </div>
      <OnboardingModal />
    </div>
  );
}
