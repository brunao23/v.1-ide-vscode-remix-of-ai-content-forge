import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { getAgentById } from '@/services/chatService';
import { AI_MODELS } from '@/types';
import { ChevronDown, Share, MoreHorizontal, PanelLeft, Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import gemzLogo from '@/assets/gemz-logo.png';

export default function Header() {
  const { activeAgentId, selectedModel, setSelectedModel, sidebarOpen, setSidebarOpen } = useChatStore();
  const [modelDropdown, setModelDropdown] = useState(false);
  const agent = getAgentById(activeAgentId);
  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const isMobile = useIsMobile();

  return (
    <header className="h-12 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <>
            <img src={gemzLogo} alt="Gemz AI" className="w-[18px] h-[18px] rounded-sm" />
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Abrir barra lateral"
              aria-label="Abrir sidebar"
            >
              {isMobile ? <Menu className="w-[18px] h-[18px] text-muted-foreground" /> : <PanelLeft className="w-[18px] h-[18px] text-muted-foreground" />}
            </button>
          </>
        )}

        <div className="relative">
          <button
            onClick={() => setModelDropdown(!modelDropdown)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Selecionar modelo"
          >
            <span className="text-[17px] font-normal text-foreground truncate max-w-[200px] sm:max-w-none">
              {agent?.name || 'Chat'}
            </span>
            {currentModel && (
              <span className="text-[17px] font-normal text-muted-foreground hidden sm:inline">
                {currentModel.name}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {modelDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover rounded-xl shadow-lg border border-border min-w-[220px] p-2">
                <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Modelo</p>
                {AI_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setModelDropdown(false); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedModel === model.id ? 'bg-secondary text-foreground' : 'hover:bg-secondary text-foreground'
                    }`}
                  >
                    <span>{model.name}{model.badge && <span className="text-xs text-muted-foreground"> {model.badge}</span>}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right side - icon buttons only, no bordered "Compartilhar" */}
      <div className="flex items-center gap-1">
        {!isMobile && (
          <button className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Compartilhar">
            <Share className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
        )}
        <button className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Mais opções">
          <MoreHorizontal className="w-[18px] h-[18px] text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
