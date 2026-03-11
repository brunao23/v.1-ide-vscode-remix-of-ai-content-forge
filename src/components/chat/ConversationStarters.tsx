import { useState, useEffect } from 'react';
import { Agent, AGENT_AVATARS } from '@/types';
import { motion } from 'framer-motion';
import { Check, Globe, Linkedin } from 'lucide-react';
import AgentLoadingScreen from '@/components/agents/AgentLoadingScreen';

interface Props {
  agent: Agent;
  onStarterClick: (starter: string) => void;
}

export default function ConversationStarters({ agent, onStarterClick }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [agent.id]);

  if (!imageLoaded) {
    const img = new Image();
    img.src = AGENT_AVATARS[agent.id];
    img.onload = () => setImageLoaded(true);
  }

  if (!imageLoaded) {
    return <AgentLoadingScreen />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-4" style={{ paddingTop: '12vh' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-[600px] w-full"
      >
        {/* Agent avatar */}
        <img
          src={AGENT_AVATARS[agent.id]}
          alt={agent.name}
          className="w-[72px] h-[72px] rounded-full object-cover mx-auto mb-4"
        />

        {/* Agent name */}
        <h1 className="text-[28px] font-semibold text-foreground mb-2">{agent.name}</h1>

        {/* Creator line */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">Por gemz.ai</span>
          <button
            className="p-1 rounded-full hover:bg-accent transition-colors"
            aria-label="Website"
            onClick={() => window.open('https://gemz.ai', '_blank')}
          >
            <Globe className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
          </button>
          <button
            className="p-1 rounded-full hover:bg-accent transition-colors"
            aria-label="LinkedIn"
            onClick={() => window.open('https://linkedin.com', '_blank')}
          >
            <Linkedin className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </div>

        {/* Recommended model line */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <Check className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-[13px] text-muted-foreground">
            Usando o modelo recomendado pelo criador: {agent.recommendedModel}
          </span>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-[15px] leading-relaxed max-w-[500px] mx-auto mb-8">
          {agent.description}
        </p>

        {/* Conversation starters — outline buttons */}
        <div className={`flex flex-wrap justify-center gap-2.5 max-w-lg mx-auto ${agent.starters.length === 1 ? '' : ''}`}>
          {agent.starters.map((starter, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              onClick={() => onStarterClick(starter)}
              className="px-4 py-2.5 rounded-2xl border border-border bg-transparent hover:border-muted-foreground/50 transition-colors cursor-pointer"
            >
              <span className="text-sm text-muted-foreground">{starter}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
