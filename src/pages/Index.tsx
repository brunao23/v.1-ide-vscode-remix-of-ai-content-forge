import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import { useChatStore } from '@/stores/chatStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

export default function Index() {
  const { sidebarOpen, setSidebarOpen } = useChatStore();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Mobile hamburger always visible when sidebar closed */}
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
      <ChatArea />
    </div>
  );
}
