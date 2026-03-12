import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import MarketResearchPage from '@/pages/MarketResearchPage';
import HomePage from '@/pages/HomePage';
import CreatorKitPage from '@/pages/CreatorKitPage';
import { useChatStore } from '@/stores/chatStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

export default function Index() {
  const { sidebarOpen, setSidebarOpen, activePage, setActivePage } = useChatStore();
  const isMobile = useIsMobile();

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <HomePage />;
      case 'market-research':
        return <MarketResearchPage onBack={() => setActivePage('home')} />;
      case 'creator-kit':
        return <CreatorKitPage />;
      default:
        return <ChatArea />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-30 p-2 rounded-lg bg-card border border-border hover:bg-secondary transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
      )}
      <Sidebar />
      {renderPage()}
    </div>
  );
}
