import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { getAgentById } from '@/services/chatService';
import { AI_MODELS } from '@/types';
import { ChevronDown, ChevronRight, Share, MoreHorizontal, PanelLeft, Menu, Check, Sparkles, Zap, Brain } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import gemzLogo from '@/assets/gemz-logo.png';

// Latest models shown in main dropdown
const LATEST_MODELS = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Escolhe por quanto tempo pensar',
    icon: Sparkles,
  },
  {
    id: 'chatgpt-5.3-instant',
    name: 'Instant 5.3',
    description: 'Respostas imediatas',
    icon: Zap,
  },
  {
    id: 'chatgpt-5.3',
    name: 'Thinking 5.4',
    description: 'Pensa mais para gerar respostas melhores',
    icon: Brain,
  },
];

// Older models shown in flyout submenu
const OLDER_MODELS = [
  { id: 'chatgpt-5.3-pro', name: 'GPT-5.2 Instant' },
  { id: 'claude-opus-4.5', name: 'GPT-5.2 Thinking' },
  { id: 'claude-sonnet-4.5', name: 'GPT-5 Thinking mini' },
  { id: 'gemini-2.5-pro', name: 'o3' },
];

export default function Header() {
  const { activeAgentId, selectedModel, setSelectedModel, sidebarOpen, setSidebarOpen, activePage } = useChatStore();
  const [modelDropdown, setModelDropdown] = useState(false);
  const [showOlderSubmenu, setShowOlderSubmenu] = useState(false);
  const agent = getAgentById(activeAgentId);
  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const isMobile = useIsMobile();
  const isHome = activePage === 'home';

  // Display name for the selector
  const displayName = isHome
    ? (LATEST_MODELS.find(m => m.id === selectedModel)?.name || currentModel?.name || 'Auto')
    : (agent?.name || 'Chat');

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
            onClick={() => { setModelDropdown(!modelDropdown); setShowOlderSubmenu(false); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Selecionar modelo"
          >
            <span className="text-[17px] font-normal text-foreground truncate max-w-[200px] sm:max-w-none">
              {displayName}
            </span>
            {!isHome && currentModel && (
              <span className="text-[17px] font-normal text-muted-foreground hidden sm:inline">
                {currentModel.name}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {modelDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setModelDropdown(false); setShowOlderSubmenu(false); }} />

              {isHome ? (
                /* ========== HOME: Flyout submenu style ========== */
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover rounded-xl shadow-lg border border-border min-w-[300px] p-1.5">
                  {/* Latest section */}
                  {LATEST_MODELS.map((model) => {
                    const Icon = model.icon;
                    const isSelected = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setModelDropdown(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                          isSelected ? 'bg-secondary' : 'hover:bg-secondary'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        <div className="flex-1 min-w-0">
                          <span className="block font-medium text-foreground">{model.name}</span>
                          <span className="block text-xs text-muted-foreground">{model.description}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>
                    );
                  })}

                  {/* Separator */}
                  <div className="my-1.5 mx-3 border-t border-border" />

                  {/* Older models trigger */}
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowOlderSubmenu(true)}
                      onClick={() => setShowOlderSubmenu(!showOlderSubmenu)}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between hover:bg-secondary"
                    >
                      <span className="text-foreground font-medium">Modelos antigos</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Flyout submenu */}
                    {showOlderSubmenu && (
                      <div
                        className="absolute left-full top-0 ml-1 bg-popover rounded-xl shadow-lg border border-border min-w-[220px] p-1.5"
                        onMouseEnter={() => setShowOlderSubmenu(true)}
                        onMouseLeave={() => setShowOlderSubmenu(false)}
                      >
                        {OLDER_MODELS.map((model) => {
                          const isSelected = selectedModel === model.id;
                          return (
                            <button
                              key={model.id}
                              onClick={() => { setSelectedModel(model.id); setModelDropdown(false); setShowOlderSubmenu(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                isSelected ? 'bg-secondary' : 'hover:bg-secondary'
                              }`}
                            >
                              <span className="text-foreground">{model.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ========== AGENT: Original grouped dropdown ========== */
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover rounded-xl shadow-lg border border-border min-w-[280px] p-2 max-h-[70vh] overflow-y-auto">
                  {(['openai', 'anthropic', 'google'] as const).map((provider, idx) => {
                    const providerModels = AI_MODELS.filter(m => m.provider === provider);
                    if (providerModels.length === 0) return null;
                    const label = provider === 'openai' ? 'ChatGPT' : provider === 'anthropic' ? 'Claude' : 'Gemini';
                    return (
                      <div key={provider}>
                        {idx > 0 && <div className="my-1.5 mx-3 border-t border-border" />}
                        <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">{label}</p>
                        {providerModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => { setSelectedModel(model.id); setModelDropdown(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                              selectedModel === model.id ? 'bg-secondary text-foreground' : 'hover:bg-secondary text-foreground'
                            }`}
                          >
                            <div>
                              <span className="block font-medium">{model.name}</span>
                              <span className="block text-xs text-muted-foreground">{model.description}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              {model.badge && <span className="text-xs text-muted-foreground">{model.badge}</span>}
                              {selectedModel === model.id && (
                                <Check className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
