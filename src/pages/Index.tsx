import Sidebar from '@/components/layout/Sidebar';
import ChatArea from '@/components/chat/ChatArea';

export default function Index() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <ChatArea />
    </div>
  );
}
