import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { getAgentById } from '@/services/chatService';
import { AI_MODELS } from '@/types';
import { ChevronDown, Share, MoreHorizontal, PanelLeft, Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Header() {
  const { activeAgentId, selectedModel, setSelectedModel, sidebarOpen, setSidebarOpen } = useChatStore();
  const [modelDropdown, setModelDropdown] = useState(false);
  const agent = getAgentById(activeAgentId);
  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const isMobile = useIsMobile();

  return (
    <header className="h-14 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors mr-1"
            aria-label="Abrir sidebar"
          >
            {isMobile ? <Menu className="w-4 h-4 text-muted-foreground" /> : <PanelLeft className="w-4 h-4 text-muted-foreground" />}
          </button>
        )}
        {/* Mobile hamburger when sidebar closed */}
        {isMobile && sidebarOpen === false && null}
        
        <div className="relative">
          <button
            onClick={() => setModelDropdown(!modelDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Selecionar modelo"
          >
            <span className="text-base font-semibold text-foreground truncate max-w-[150px] sm:max-w-none">
              {agent?.name || 'Chat'}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {currentModel && (
            <span className="ml-1 text-sm font-medium text-primary hidden sm:inline">
              {currentModel.name}
            </span>
          )}

          {modelDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover rounded-xl shadow-lg border border-border-secondary min-w-[220px] p-2">
                <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">Modelo</p>
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setModelDropdown(false); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                      selectedModel === model.id ? 'bg-secondary text-foreground' : 'hover:bg-secondary text-foreground'
                    }`}
                  >
                    <span>{model.name}</span>
                    {model.badge && <span className="text-xs text-primary">{model.badge}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isMobile && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-secondary text-sm text-foreground hover:bg-secondary transition-colors" aria-label="Compartilhar">
            <Share className="w-4 h-4" />
            <span>Compartilhar</span>
          </button>
        )}
        <button className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Mais opções">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
