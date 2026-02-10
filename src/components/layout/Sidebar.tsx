import { useState, useRef, useCallback } from 'react';
import { AGENTS } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { PanelLeft, Pencil, Search, Image, AppWindow, BookOpen, MessageSquare } from 'lucide-react';

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, activeAgentId, setActiveAgent, conversations, activeConversationId, setActiveConversation } = useChatStore();

  const agentConversations = conversations.filter(c => c.agentId === activeAgentId);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-[260px] h-screen bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2 px-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">C</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setActiveConversation(null);
            }}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Novo chat"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            title="Fechar sidebar"
          >
            <PanelLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Nav items */}
      <div className="px-2 space-y-0.5">
        <NavItem icon={<Search className="w-[18px] h-[18px]" />} label="Buscar" />
        <NavItem icon={<Image className="w-[18px] h-[18px]" />} label="Imagens" />
        <NavItem icon={<AppWindow className="w-[18px] h-[18px]" />} label="Aplicativos" />
        <NavItem icon={<BookOpen className="w-[18px] h-[18px]" />} label="Documentos" />
      </div>

      {/* Agents Section */}
      <div className="mt-4 px-2">
        <span className="px-3 text-xs font-medium text-muted-foreground tracking-wide uppercase">
          Agentes
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 mt-2 space-y-0.5">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeAgentId === agent.id ? 'bg-secondary' : 'hover:bg-secondary'
            }`}
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
              style={{ background: agent.color + '22' }}>
              {agent.emoji}
            </span>
            <span className="text-sm text-foreground truncate">{agent.name}</span>
          </button>
        ))}

        {/* Conversation history for active agent */}
        {agentConversations.length > 0 && (
          <div className="mt-4">
            <span className="px-3 text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Conversas
            </span>
            <div className="mt-1 space-y-0.5">
              {agentConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
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

      {/* Footer - user */}
      <div className="p-2 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-semibold">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">Usuário</p>
            <p className="text-xs text-muted-foreground">Pro</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground">{label}</span>
    </button>
  );
}
